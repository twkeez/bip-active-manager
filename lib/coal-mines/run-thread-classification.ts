import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyThreads, type ThreadToClassify } from "@/lib/coal-mines/classify-threads";
import { fetchLatestThreadMessages } from "@/lib/basecamp/thread-latest";
import {
  AWAITING_REPLY_DAYS,
  isInternalThread,
  verdictIsCurrent,
  type ThreadRow,
} from "@/lib/coal-mines/basecamp-threads";

/**
 * Reads the last message of every candidate thread and records whether it
 * leaves something outstanding.
 *
 * Lives here rather than in a route because two callers need it and must not
 * drift: the button an admin presses, and the scheduled job. The only
 * difference between them is how the caller was authenticated.
 */

export type ClassificationRun = {
  considered: number;
  classified: number;
  fullMessagesFetched: number;
  waitingOnUs: number;
  waitingOnThem: number;
  escalated: number;
  message?: string;
};

type Row = ThreadRow & {
  basecamp_recording_id: number;
  basecamp_project_id: string | null;
  thread_excerpt: string | null;
};

export async function runThreadClassification(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<ClassificationRun> {
  const { data: rows, error } = await admin
    .from("basecamp_communication_events")
    .select(
      "basecamp_recording_id, basecamp_project_id, client_id, thread_title, thread_url, thread_excerpt, occurred_at, is_internal, reply_need, reply_need_reason, reply_need_escalated, classified_excerpt",
    )
    .order("occurred_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(error.message);

  const { data: clients } = await admin.from("clients").select("id, account_name");
  const names = new Map<number, string>(
    (clients ?? []).map((c) => [c.id as number, c.account_name as string]),
  );

  const daysSince = (iso: string) =>
    Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);

  // Only threads the canary would surface, and only those whose last message
  // has changed since it was read.
  const pending = (rows ?? []).filter(
    (r) =>
      !isInternalThread(r.thread_title) &&
      daysSince(r.occurred_at) >= AWAITING_REPLY_DAYS &&
      (r.thread_excerpt ?? "").trim().length > 0 &&
      !verdictIsCurrent(r),
  );

  const empty: ClassificationRun = {
    considered: 0,
    classified: 0,
    fullMessagesFetched: 0,
    waitingOnUs: 0,
    waitingOnThem: 0,
    escalated: 0,
    message: "Everything already read.",
  };
  if (pending.length === 0) return empty;

  // Basecamp's topics feed truncates its excerpt at 100 characters, so pull the
  // real last message for the handful about to be judged. A thread that cannot
  // be read falls back to the excerpt — a fragment beats refusing to classify.
  const latest = await fetchLatestThreadMessages(
    pending
      .filter((r) => r.basecamp_project_id)
      .map((r) => ({
        key: r.basecamp_recording_id,
        projectId: r.basecamp_project_id as string,
        messageId: r.basecamp_recording_id,
      })),
  );

  const candidates: ThreadToClassify[] = pending.map((r) => ({
    recordingId: r.basecamp_recording_id,
    clientName: names.get(r.client_id) ?? `Client ${r.client_id}`,
    title: r.thread_title?.trim() || "(untitled thread)",
    excerpt: (latest.get(r.basecamp_recording_id)?.content ?? r.thread_excerpt ?? "").slice(0, 4000),
    weSpokeLast: r.is_internal === true,
    lastAuthor: latest.get(r.basecamp_recording_id)?.authorName ?? null,
    daysSince: daysSince(r.occurred_at),
  }));

  const verdicts = await classifyThreads(candidates);

  // Keyed on thread_excerpt — the column the sync updates when a thread moves
  // on. Storing the text we judged on would never compare equal once messages
  // exceed the truncation limit, and every thread would look permanently unread.
  const staleKeyById = new Map(
    pending.map((r) => [r.basecamp_recording_id, r.thread_excerpt ?? null]),
  );
  const classifiedAt = now.toISOString();

  let written = 0;
  for (const v of verdicts) {
    const { error: updateError } = await admin
      .from("basecamp_communication_events")
      .update({
        reply_need: v.replyNeed,
        reply_need_reason: v.reason,
        reply_need_escalated: v.escalated,
        classified_excerpt: staleKeyById.get(v.recordingId) ?? null,
        classified_at: classifiedAt,
      })
      .eq("basecamp_recording_id", v.recordingId);
    if (!updateError) written += 1;
  }

  // "needs_reply" means opposite things depending on who spoke last, so it is
  // reported split rather than as one misleading total.
  const spokeLastById = new Map(candidates.map((c) => [c.recordingId, c.weSpokeLast]));
  const needsReply = verdicts.filter((v) => v.replyNeed === "needs_reply");

  return {
    considered: candidates.length,
    classified: written,
    fullMessagesFetched: latest.size,
    waitingOnUs: needsReply.filter((v) => spokeLastById.get(v.recordingId) === false).length,
    waitingOnThem: needsReply.filter((v) => spokeLastById.get(v.recordingId) === true).length,
    escalated: verdicts.filter((v) => v.escalated).length,
  };
}
