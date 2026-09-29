import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { htmlToText, isAccessThread, redactCredentials } from "@/lib/onboarding/background-safety";
import { PoobahError } from "./validate";

/**
 * A watched client's Basecamp conversation, read from what BIP Control already
 * syncs (every 30 minutes on weekdays): each post with its words, and the
 * Response Report's "who is waiting on whom". For Claude through the
 * connector, so a status update can say what the client is asking for.
 *
 * Credential-safe twice over: the sync stores no words from access threads and
 * strips credential-looking lines, and this scrubs again on the way out
 * (including the older opening-message text, stored before scrubbing existed).
 */

/** Posts stored before this date have no words: the sync kept only who and when. */
export const POST_TEXT_SINCE = "2026-09-29";
/** A weekday sync runs every 30 minutes; older than this means something stopped. */
const STALE_AFTER_HOURS = 3;

type EventRow = {
  id: number;
  basecamp_project_id: string;
  basecamp_project_name: string | null;
  basecamp_recording_id: number;
  parent_recording_id: number | null;
  kind: "message" | "comment";
  occurred_at: string;
  author_email: string | null;
  author_name: string | null;
  is_internal: boolean;
  thread_title: string | null;
  thread_body: string | null;
  thread_url: string | null;
  post_text: string | null;
  post_text_redacted_lines: number | null;
  post_text_withheld: string | null;
};

export type BasecampPost = {
  at: string;
  author: string;
  side: "Beyond Indigo" | "client";
  text: string | null;
  /** Why there are no words, or what was removed. */
  note: string | null;
};

export type BasecampThread = {
  title: string;
  project: string;
  url: string | null;
  last_post_at: string;
  last_post_side: "Beyond Indigo" | "client";
  posts: BasecampPost[];
};

function scrub(text: string | null, title: string | null): { text: string | null; removed: number } {
  if (!text || isAccessThread(title)) return { text: null, removed: 0 };
  const { text: kept, removed } = redactCredentials(text);
  return { text: kept.trim() || null, removed };
}

export async function loadBasecampActivity(
  admin: SupabaseClient,
  clientId: number,
  sinceDays: number,
): Promise<{
  sync: { last_synced_at: string | null; stale: boolean; last_error: string | null; note: string };
  window: { since: string; until: string };
  waiting: Record<string, unknown>[];
  counts: { threads: number; posts: number; posts_without_words: number; withheld_access_posts: number };
  complete: true;
  note: string;
  threads: BasecampThread[];
}> {
  if (!Number.isInteger(sinceDays) || sinceDays < 1 || sinceDays > 365) throw new PoobahError("since_days must be between 1 and 365.");
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

  // Read by the client's Basecamp project, not by client id: when two client
  // records point at one project (duplicates), the sync files its posts under
  // whichever claimed it first, and a client-id read of the other finds none.
  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("account_name,basecamp_project_id")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw new PoobahError(`Could not read the client: ${clientError.message}`, 500);
  const projectId = (clientRow?.basecamp_project_id as string | null | undefined)?.trim() || null;
  if (!projectId) {
    throw new PoobahError(
      `${clientRow?.account_name ?? `Client ${clientId}`} has no Basecamp project linked in BIP Control, so there is no Basecamp to read. Link it at /basecamp-projects (Project Wiring).`,
      404,
    );
  }

  const [events, sync, report] = await Promise.all([
    fetchAllRows<EventRow>(
      (from, to) =>
        admin
          .from("basecamp_communication_events")
          .select(
            "id,basecamp_project_id,basecamp_project_name,basecamp_recording_id,parent_recording_id,kind,occurred_at,author_email,author_name,is_internal,thread_title,thread_body,thread_url,post_text,post_text_redacted_lines,post_text_withheld",
          )
          .eq("basecamp_project_id", projectId)
          .gte("occurred_at", since)
          .order("occurred_at")
          .order("id")
          .range(from, to),
      "Basecamp posts",
    ).catch((error: Error) => {
      if (/post_text|author_name/.test(error.message)) {
        throw new PoobahError("Basecamp post text is not set up yet: run supabase/migrations/20260929150000_basecamp_post_text.sql.", 500);
      }
      throw new PoobahError(`Could not read Basecamp posts: ${error.message}`, 500);
    }),
    admin.from("basecamp_sync_state").select("last_synced_at,last_error").eq("id", 1).maybeSingle(),
    admin
      .from("basecamp_response_report")
      .select(
        "basecamp_project_name,client_spoke_last,days_since_client_contact,days_since_our_reply,last_client_at,last_client_author,last_client_thread_title,last_client_thread_url,last_internal_at,last_internal_author,last_internal_thread_title,last_internal_thread_url",
      )
      .eq("basecamp_project_id", projectId),
  ]);
  if (sync.error) throw new PoobahError(`Could not read the Basecamp sync state: ${sync.error.message}`, 500);
  if (report.error) throw new PoobahError(`Could not read the Response Report: ${report.error.message}`, 500);

  // The opening post of a thread is stored twice: as the thread's "message"
  // row (with the older, unscrubbed thread_body) and as a "comment" row whose
  // recording id is the message id. Posts come from the comment rows; the
  // message row only lends its body when the comment row has no words yet.
  const openingBody = new Map<number, { body: string | null; title: string | null }>();
  for (const row of events) if (row.kind === "message") openingBody.set(row.basecamp_recording_id, { body: row.thread_body, title: row.thread_title });

  const threads = new Map<string, BasecampThread>();
  let posts = 0;
  let withoutWords = 0;
  let withheld = 0;
  const comments = events.filter((row) => row.kind === "comment");
  // Threads whose only rows in the window are message rows (no per-post rows
  // yet) still count: they become one post from the message row.
  const threadsWithComments = new Set(comments.map((row) => `${row.basecamp_project_id}:${row.parent_recording_id}`));
  const postRows = [
    ...comments,
    ...events.filter((row) => row.kind === "message" && !threadsWithComments.has(`${row.basecamp_project_id}:${row.basecamp_recording_id}`)),
  ].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id - b.id);

  for (const row of postRows) {
    const threadId = row.kind === "comment" ? row.parent_recording_id : row.basecamp_recording_id;
    const key = `${row.basecamp_project_id}:${threadId}`;
    const side = row.is_internal ? "Beyond Indigo" : "client";
    let text: string | null = null;
    let note: string | null = null;
    if (row.post_text_withheld === "access_thread" || isAccessThread(row.thread_title)) {
      note = "Words not kept: this thread is for logins/access.";
      withheld += 1;
    } else if (row.post_text) {
      const scrubbed = scrub(row.post_text, row.thread_title);
      text = scrubbed.text;
      const removed = (row.post_text_redacted_lines ?? 0) + scrubbed.removed;
      if (removed) note = `${removed} line${removed === 1 ? "" : "s"} removed that looked like a login or password.`;
    } else {
      const opening = row.kind === "message" || row.basecamp_recording_id === threadId ? openingBody.get(threadId ?? -1) : undefined;
      const scrubbed = scrub(opening?.body ? htmlToText(opening.body) : null, opening?.title ?? row.thread_title);
      text = scrubbed.text;
      if (!text) {
        withoutWords += 1;
        note = `Words not captured: posts before ${POST_TEXT_SINCE} were stored as who-and-when only.`;
      } else if (scrubbed.removed) {
        note = `${scrubbed.removed} line${scrubbed.removed === 1 ? "" : "s"} removed that looked like a login or password.`;
      }
    }
    const post: BasecampPost = {
      at: row.occurred_at,
      author: row.author_name ?? row.author_email ?? "unknown",
      side,
      text,
      note,
    };
    const thread = threads.get(key) ?? {
      title: row.thread_title ?? "(untitled thread)",
      project: row.basecamp_project_name ?? row.basecamp_project_id,
      url: row.thread_url,
      last_post_at: row.occurred_at,
      last_post_side: side,
      posts: [],
    };
    thread.posts.push(post);
    thread.last_post_at = row.occurred_at;
    thread.last_post_side = side;
    threads.set(key, thread);
    posts += 1;
  }

  const lastSynced = (sync.data as { last_synced_at: string | null } | null)?.last_synced_at ?? null;
  const lastError = (sync.data as { last_error: string | null } | null)?.last_error ?? null;
  const ageHours = lastSynced ? (Date.now() - new Date(lastSynced).getTime()) / 3_600_000 : Infinity;
  const stale = ageHours > STALE_AFTER_HOURS;
  const threadList = [...threads.values()].sort((a, b) => b.last_post_at.localeCompare(a.last_post_at));
  return {
    sync: {
      last_synced_at: lastSynced,
      stale,
      last_error: lastError,
      note: !lastSynced
        ? "Basecamp has never synced; there is nothing to trust here."
        : stale
          ? `STALE: Basecamp last synced ${Math.round(ageHours)} hours ago. Anything newer is missing. (Syncs run every 30 minutes on weekdays and once a day at weekends, so a weekend gap can be normal.)`
          : `Basecamp synced ${Math.round(ageHours * 60)} minutes ago.`,
    },
    window: { since, until: new Date().toISOString() },
    waiting: (report.data ?? []).map((row) => ({
      project: row.basecamp_project_name,
      waiting_on: row.client_spoke_last ? "us (the client spoke last)" : "the client (we spoke last)",
      days_since_client_contact: row.days_since_client_contact,
      days_since_our_reply: row.days_since_our_reply,
      last_client_post: row.last_client_at
        ? { at: row.last_client_at, author: row.last_client_author, thread: row.last_client_thread_title, url: row.last_client_thread_url }
        : null,
      last_our_post: row.last_internal_at
        ? { at: row.last_internal_at, author: row.last_internal_author, thread: row.last_internal_thread_title, url: row.last_internal_thread_url }
        : null,
    })),
    counts: { threads: threadList.length, posts, posts_without_words: withoutWords, withheld_access_posts: withheld },
    complete: true,
    note: `${posts} of ${posts} posts in the last ${sinceDays} days shown, in ${threadList.length} threads, newest thread first.${
      withoutWords ? ` ${withoutWords} have no words (stored before ${POST_TEXT_SINCE}).` : ""
    }`,
    threads: threadList,
  };
}
