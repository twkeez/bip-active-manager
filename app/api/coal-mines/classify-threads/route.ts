import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/profile";
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
 * actually leaves something outstanding.
 *
 * Runs on demand rather than on page load: opening Coal Mines should never cost
 * an API call. Only threads whose last message has changed since they were last
 * read are sent, so repeat runs are usually free.
 */

export const maxDuration = 300;

type Row = ThreadRow & {
  basecamp_recording_id: number;
  basecamp_project_id: string | null;
  thread_excerpt: string | null;
};

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(supabase);
  // Each run is a paid Claude call, and this is an admin surface.
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("basecamp_communication_events")
    .select(
      "basecamp_recording_id, basecamp_project_id, client_id, thread_title, thread_url, thread_excerpt, occurred_at, is_internal, reply_need, reply_need_reason, reply_need_escalated, classified_excerpt",
    )
    .order("occurred_at", { ascending: false })
    .returns<Row[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: clients } = await admin.from("clients").select("id, account_name");
  const names = new Map<number, string>(
    (clients ?? []).map((c) => [c.id as number, c.account_name as string]),
  );

  const now = Date.now();
  const daysSince = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 86_400_000);

  // Only threads the canary would surface, and only those whose last message
  // has changed since it was read.
  const pending = (rows ?? []).filter(
    (r) =>
      !isInternalThread(r.thread_title) &&
      daysSince(r.occurred_at) >= AWAITING_REPLY_DAYS &&
      (r.thread_excerpt ?? "").trim().length > 0 &&
      !verdictIsCurrent(r),
  );

  // The stored excerpt is capped at 100 characters by Basecamp's topics feed,
  // which truncates most messages mid-sentence. Pull the real last message for
  // the handful about to be judged; fall back to the excerpt if it cannot be
  // read, since a fragment beats refusing to classify.
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

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, classified: 0, message: "Everything already read." });
  }

  try {
    const verdicts = await classifyThreads(candidates);
    // Keyed on thread_excerpt — the column the sync updates when a thread moves
    // on. Storing the (possibly longer, possibly truncated) text we judged on
    // would never compare equal, and every thread would look permanently stale.
    const staleKeyById = new Map(
      pending.map((r) => [r.basecamp_recording_id, r.thread_excerpt ?? null]),
    );
    const classifiedAt = new Date().toISOString();

    // Written one at a time: an upsert here would need every not-null column of
    // a wide table, and this is at most a few dozen small updates.
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

    // "needs_reply" means different things depending on who spoke last, so the
    // total is reported split rather than as one misleading number.
    const spokeLastById = new Map(candidates.map((c) => [c.recordingId, c.weSpokeLast]));
    const needsReply = verdicts.filter((v) => v.replyNeed === "needs_reply");

    return NextResponse.json({
      ok: true,
      considered: candidates.length,
      classified: written,
      fullMessagesFetched: latest.size,
      waitingOnUs: needsReply.filter((v) => spokeLastById.get(v.recordingId) === false).length,
      waitingOnThem: needsReply.filter((v) => spokeLastById.get(v.recordingId) === true).length,
      escalated: verdicts.filter((v) => v.escalated).length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Classification failed" },
      { status: 500 },
    );
  }
}
