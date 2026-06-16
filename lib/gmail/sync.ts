import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getMessageDetail,
  listInboxMessageIds,
  modifyMessageLabels,
} from "@/lib/gmail/client";
import { normalizeGmailMessage } from "@/lib/gmail/normalize";
import { evaluateSenderRules, loadSenderRules } from "@/lib/gmail/rules";

type SyncResult = {
  synced: number;
  blacklistedArchived: number;
  highPriority: number;
  nextPageToken: string | null;
};

export async function syncInboxPageForUser(params: {
  admin: SupabaseClient;
  userId: string;
  accessToken: string;
  pageToken?: string;
}) {
  const list = await listInboxMessageIds(params.accessToken, params.pageToken);
  const rules = await loadSenderRules(params.admin, params.userId);
  const messageRefs = list.messages ?? [];
  let synced = 0;
  let blacklistedArchived = 0;
  let highPriority = 0;
  const now = new Date().toISOString();

  for (const ref of messageRefs) {
    const messageId = ref.id?.trim();
    if (!messageId) continue;
    const detail = await getMessageDetail(params.accessToken, messageId);
    const normalized = normalizeGmailMessage(detail);
    if (!normalized.gmailMessageId || !normalized.gmailThreadId) continue;
    const senderEval = evaluateSenderRules({
      fromEmail: normalized.fromEmail,
      rules,
    });
    const triageStatus = senderEval.isBlacklisted ? "archived" : "inbox";
    const needsAction = !senderEval.isBlacklisted;
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
        needs_action: needsAction,
        is_high_priority: isHighPriority,
        raw_payload: normalized.rawPayload,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: "owner_user_id,gmail_message_id" },
    );
    if (error) {
      throw new Error(`Failed to upsert email message: ${error.message}`);
    }
    if (senderEval.isBlacklisted) {
      await modifyMessageLabels(params.accessToken, normalized.gmailMessageId, {
        removeLabelIds: ["INBOX"],
      });
    }
    synced += 1;
    if (senderEval.isBlacklisted) blacklistedArchived += 1;
    if (isHighPriority) highPriority += 1;
  }

  const { error: cursorError } = await params.admin.from("user_email_sync_cursors").upsert(
    {
      owner_user_id: params.userId,
      gmail_history_id: null,
      last_synced_at: now,
      updated_at: now,
    },
    { onConflict: "owner_user_id" },
  );
  if (cursorError) {
    throw new Error(`Failed to update email sync cursor: ${cursorError.message}`);
  }

  return {
    synced,
    blacklistedArchived,
    highPriority,
    nextPageToken: list.nextPageToken ?? null,
  } satisfies SyncResult;
}
