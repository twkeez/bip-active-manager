import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getMessageDetail,
  listInboxMessageIds,
  modifyMessageLabels,
} from "@/lib/gmail/client";
import { normalizeGmailMessage } from "@/lib/gmail/normalize";
import { evaluateSenderRules, loadSenderRules } from "@/lib/gmail/rules";

type PageResult = {
  synced: number;
  blacklistedArchived: number;
  highPriority: number;
  nextPageToken: string | null;
};

type SyncResult = {
  synced: number;
  blacklistedArchived: number;
  highPriority: number;
  pages: number;
  lastSyncedAt: string;
  /**
   * False when the time budget ran out before Gmail's last page. The cursor is
   * then left where it was, so the next sync covers the same window again and
   * nothing is skipped.
   */
  complete: boolean;
};

// Processes one page of inbox messages. Does NOT touch the sync cursor — the
// caller updates it once after all pages are done.
async function processInboxPage(params: {
  admin: SupabaseClient;
  userId: string;
  accessToken: string;
  pageToken?: string;
  afterEpoch?: number;
  now: string;
  rules: Awaited<ReturnType<typeof loadSenderRules>>;
}): Promise<PageResult> {
  const list = await listInboxMessageIds(
    params.accessToken,
    params.pageToken,
    params.afterEpoch,
  );
  const messageRefs = list.messages ?? [];
  let synced = 0;
  let blacklistedArchived = 0;
  let highPriority = 0;

  // Fetch + store messages with bounded concurrency (each id is an independent
  // Gmail call + upsert). Keeps a large initial pull within the timeout while
  // staying under Gmail's per-user rate limits.
  const CONCURRENCY = 8;
  for (let i = 0; i < messageRefs.length; i += CONCURRENCY) {
    const chunk = messageRefs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (ref) => {
        const messageId = ref.id?.trim();
        if (!messageId) return null;
        const detail = await getMessageDetail(params.accessToken, messageId);
        const normalized = normalizeGmailMessage(detail);
        if (!normalized.gmailMessageId || !normalized.gmailThreadId) return null;
        const senderEval = evaluateSenderRules({
          fromEmail: normalized.fromEmail,
          rules: params.rules,
        });
        const triageStatus = senderEval.isBlacklisted ? "archived" : "inbox";
        // needs_action is the owner's own "come back to this" flag, set from the
        // inbox or by turning a message into a task. Sync must never set it —
        // doing so marked every message and made the view a copy of the inbox.
        //
        // is_high_priority is likewise owned by the user and the AI scorer, so
        // it is only ever raised here, never cleared. Writing the computed value
        // unconditionally wiped manual flags and AI scores on the next sync.
        const isHighPriority = senderEval.isAlwaysHighPriority || normalized.isStarred;
        const { error } = await params.admin.from("user_email_messages").upsert(
          {
            owner_user_id: params.userId,
            gmail_message_id: normalized.gmailMessageId,
            gmail_thread_id: normalized.gmailThreadId,
            gmail_history_id: normalized.gmailHistoryId,
            subject: normalized.subject,
            from_email: normalized.fromEmail,
            from_name: normalized.fromName,
            to_emails: normalized.toEmails,
            snippet: normalized.snippet,
            body_text: normalized.bodyText,
            body_html: normalized.bodyHtml,
            internal_date: normalized.internalDate,
            label_ids: normalized.labelIds,
            is_read: normalized.isRead,
            is_starred: normalized.isStarred,
            triage_status: triageStatus,
            ...(isHighPriority ? { is_high_priority: true } : {}),
            raw_payload: normalized.rawPayload,
            last_synced_at: params.now,
            updated_at: params.now,
          },
          { onConflict: "owner_user_id,gmail_message_id" },
        );
        if (error) throw new Error(`Failed to upsert email message: ${error.message}`);
        if (senderEval.isBlacklisted) {
          await modifyMessageLabels(params.accessToken, normalized.gmailMessageId, {
            removeLabelIds: ["INBOX"],
          });
        }
        return { blacklisted: senderEval.isBlacklisted, isHighPriority };
      }),
    );
    for (const r of results) {
      if (!r) continue;
      synced += 1;
      if (r.blacklisted) blacklistedArchived += 1;
      if (r.isHighPriority) highPriority += 1;
    }
  }

  return { synced, blacklistedArchived, highPriority, nextPageToken: list.nextPageToken ?? null };
}

/**
 * Syncs the inbox, looping across pages up to `maxMessages`.
 *  - full=true (initial triage/cleanup): pulls the most recent messages, ignoring
 *    the cursor.
 *  - otherwise (incremental): only fetches messages newer than the last sync
 *    (via Gmail's `after:` filter), so repeat syncs are cheap. A 1-hour overlap
 *    buffer is applied; the upsert dedupes by message id, so overlap is harmless.
 * The sync cursor's last_synced_at is updated once at the end.
 */
export async function syncInboxForUser(params: {
  admin: SupabaseClient;
  userId: string;
  accessToken: string;
  full?: boolean;
  /** Stop starting new pages after this instant (ms); the run then reports complete: false. */
  deadlineMs?: number;
  /** Look back to this instant instead of the cursor: a one-off recovery of a missed window. */
  sinceIso?: string;
}): Promise<SyncResult> {
  const now = new Date().toISOString();
  const rules = await loadSenderRules(params.admin, params.userId);

  let afterEpoch: number | undefined;
  if (params.sinceIso) {
    const ms = new Date(params.sinceIso).getTime();
    if (Number.isFinite(ms)) afterEpoch = Math.floor(ms / 1000);
  } else if (!params.full) {
    const { data: cursor } = await params.admin
      .from("user_email_sync_cursors")
      .select("last_synced_at")
      .eq("owner_user_id", params.userId)
      .maybeSingle<{ last_synced_at: string | null }>();
    if (cursor?.last_synced_at) {
      const ms = new Date(cursor.last_synced_at).getTime();
      if (Number.isFinite(ms)) afterEpoch = Math.floor(ms / 1000) - 3600; // 1h buffer
    }
  }

  let synced = 0;
  let blacklistedArchived = 0;
  let highPriority = 0;
  let pages = 0;
  let pageToken: string | undefined;
  let complete = false;

  // Every page, to the end. This used to stop at 100 messages (300 for a full
  // pull) and still move the cursor to "now", so anything past the cap was
  // never fetched (found 2026-09-28). Only a deadline stops it early, and
  // then the cursor stays put.
  for (;;) {
    if (params.deadlineMs !== undefined && Date.now() >= params.deadlineMs) break;
    const page = await processInboxPage({
      admin: params.admin,
      userId: params.userId,
      accessToken: params.accessToken,
      pageToken,
      afterEpoch,
      now,
      rules,
    });
    synced += page.synced;
    blacklistedArchived += page.blacklistedArchived;
    highPriority += page.highPriority;
    pages += 1;
    if (!page.nextPageToken) {
      complete = true;
      break;
    }
    pageToken = page.nextPageToken;
  }

  // Advance the cursor only when every page was read. A recovery run
  // (sinceIso) never moves it backwards: it only fills a gap.
  if (complete && !params.sinceIso) {
    const { error: cursorError } = await params.admin.from("user_email_sync_cursors").upsert(
      { owner_user_id: params.userId, last_synced_at: now, updated_at: now },
      { onConflict: "owner_user_id" },
    );
    if (cursorError) {
      throw new Error(`Failed to update email sync cursor: ${cursorError.message}`);
    }
  }

  return { synced, blacklistedArchived, highPriority, pages, lastSyncedAt: now, complete };
}
