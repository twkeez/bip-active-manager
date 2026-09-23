import type { SupabaseClient } from "@supabase/supabase-js";
import { findThreadIssues, type ThreadFinding, type ThreadRow } from "@/lib/coal-mines/basecamp-threads";
import { loadThreadRows } from "@/lib/coal-mines/load-threads";
import type { RoutineFinding, RoutineResult } from "@/lib/routines/types";

/**
 * The Basecamp watch: what is outstanding right now, kept between runs.
 *
 * The daily review answered "what did it find at 9am?". Running every two
 * hours makes the more useful question "what is still waiting?", and that
 * needs memory — a thread flagged at 8am has to be in the same place at 10am,
 * with the same "waiting since", until somebody answers it.
 *
 * Three things take an item off the list, and only one of them is a person
 * clicking anything:
 *
 * - **We replied.** Someone from Beyond Indigo posted after the message that
 *   was flagged. Read from the thread itself, so answering in Basecamp is all
 *   anyone has to do.
 * - **Marked done.** For the ones answered by phone or email, where Basecamp
 *   will never show a reply.
 * - **It stopped qualifying.** The client wrote again, the thread moved on, the
 *   classifier changed its mind.
 *
 * Nothing is deleted. A resolved row keeps how it was resolved and when, which
 * is what makes "has this been sitting for a week?" answerable later.
 */

export type BasecampWatchSettings = {
  /** Days with nothing posted before a thread is flagged as gone quiet. */
  quietAfterDays: number;
};

export function readSettings(raw: Record<string, unknown>): BasecampWatchSettings {
  const value = raw.quietAfterDays;
  return {
    quietAfterDays: typeof value === "number" && Number.isFinite(value) && value >= 1 ? value : 14,
  };
}

export type WatchItemRow = {
  id: number;
  recording_id: number;
  client_name: string;
  thread_title: string;
  thread_url: string | null;
  reason: "needs_reply" | "quiet";
  reason_text: string | null;
  flagged_activity_at: string;
  first_flagged_at: string;
  state: "open" | "resolved";
};

const REASON_GROUP: Record<WatchItemRow["reason"], string> = {
  needs_reply: "Needs a reply",
  quiet: "Gone quiet",
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function waitingFor(since: string, now: Date): string {
  const hours = Math.floor((now.getTime() - Date.parse(since)) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `waiting ${plural(hours, "hour")}`;
  return `waiting ${plural(Math.floor(hours / 24), "day")}`;
}

/**
 * Whether a flagged thread has been answered by us since it was flagged.
 *
 * The stored row holds whoever spoke last and when. If that is us, and it
 * happened after the message we flagged, the thread has moved on without
 * anybody needing to tell us.
 */
export function weRepliedSince(row: ThreadRow | undefined, flaggedActivityAt: string): boolean {
  if (!row) return false;
  return row.is_internal === true && Date.parse(row.occurred_at) > Date.parse(flaggedActivityAt);
}

export async function runBasecampWatch(
  supabase: SupabaseClient,
  rawSettings: Record<string, unknown>,
  now: Date,
): Promise<RoutineResult> {
  const settings = readSettings(rawSettings);
  const { rows, clientNames, ignoredProjectIds, error } = await loadThreadRows(supabase);
  if (error) throw new Error(`Could not read Basecamp threads: ${error}`);

  const issues = findThreadIssues(rows, clientNames, now, {
    // Anything a client is waiting on counts from the moment it arrives. The
    // three-day wait belonged to a once-a-day report; a watch that runs every
    // two hours and stays quiet for three days is not a watch.
    awaitingDays: 0,
    chaseDays: settings.quietAfterDays,
    stalledDays: settings.quietAfterDays,
    ignoredProjectIds,
  });

  const byRecording = new Map<number, ThreadRow & { basecamp_recording_id?: number }>();
  for (const row of rows as Array<ThreadRow & { basecamp_recording_id?: number }>) {
    if (typeof row.basecamp_recording_id === "number") byRecording.set(row.basecamp_recording_id, row);
  }
  /** The findings keyed the way the table stores them. */
  const current = new Map<string, { finding: ThreadFinding; reason: WatchItemRow["reason"]; recordingId: number }>();
  const add = (list: ThreadFinding[], reason: WatchItemRow["reason"]) => {
    for (const finding of list) {
      const row = rows.find(
        (candidate) =>
          candidate.basecamp_project_id === finding.projectId &&
          (candidate.thread_title?.trim() || "(untitled thread)") === finding.title,
      ) as (ThreadRow & { basecamp_recording_id?: number }) | undefined;
      const recordingId = row?.basecamp_recording_id;
      if (typeof recordingId !== "number") continue;
      // A thread waiting on a reply is not also "gone quiet": the first key
      // wins, which is the more urgent reading of the same silence.
      const key = `${recordingId}:${reason}`;
      if (!current.has(key) && !current.has(`${recordingId}:needs_reply`)) {
        current.set(key, { finding, reason, recordingId });
      }
    }
  };
  add(issues.awaitingUs, "needs_reply");
  add([...issues.awaitingThem, ...issues.stalled], "quiet");

  const { data: openRows } = await supabase
    .from("basecamp_watch_items")
    .select("*")
    .eq("state", "open")
    .returns<WatchItemRow[]>();
  const open = openRows ?? [];
  const nowIso = now.toISOString();

  // --- Resolve what has moved on ------------------------------------------
  let replied = 0;
  for (const item of open) {
    if (current.has(`${item.recording_id}:${item.reason}`)) continue;
    const row = byRecording.get(item.recording_id);
    const resolution = weRepliedSince(row, item.flagged_activity_at) ? "we_replied" : "no_longer_flagged";
    if (resolution === "we_replied") replied += 1;
    await supabase
      .from("basecamp_watch_items")
      .update({ state: "resolved", resolution, resolved_at: nowIso, updated_at: nowIso })
      .eq("id", item.id);
  }

  // --- Add or refresh what is outstanding ---------------------------------
  const openKeys = new Set(open.map((item) => `${item.recording_id}:${item.reason}`));
  let added = 0;
  for (const [key, { finding, reason, recordingId }] of current) {
    const row = byRecording.get(recordingId);
    const activityAt = row?.occurred_at ?? nowIso;
    if (openKeys.has(key)) {
      // Still outstanding: keep first_flagged_at, which is the "waiting since"
      // the whole list is read by.
      await supabase
        .from("basecamp_watch_items")
        .update({ last_seen_at: nowIso, reason_text: finding.reason ?? null, updated_at: nowIso })
        .eq("recording_id", recordingId)
        .eq("reason", reason)
        .eq("state", "open");
      continue;
    }
    added += 1;
    await supabase.from("basecamp_watch_items").upsert(
      {
        recording_id: recordingId,
        basecamp_project_id: finding.projectId,
        client_id: finding.clientId,
        client_name: finding.clientName,
        thread_title: finding.title,
        thread_url: finding.url,
        reason,
        reason_text: finding.reason ?? null,
        flagged_activity_at: activityAt,
        first_flagged_at: nowIso,
        last_seen_at: nowIso,
        state: "open",
        resolution: null,
        resolved_at: null,
        resolved_by: null,
        updated_at: nowIso,
      },
      { onConflict: "recording_id,reason" },
    );
  }

  // --- Report what is on the list now -------------------------------------
  const { data: listRows } = await supabase
    .from("basecamp_watch_items")
    .select("*")
    .eq("state", "open")
    .order("first_flagged_at", { ascending: true })
    .returns<WatchItemRow[]>();
  const list = listRows ?? [];

  const findings: RoutineFinding[] = list.map((item) => ({
    group: REASON_GROUP[item.reason],
    label: item.thread_title,
    meta: [
      item.client_name,
      waitingFor(item.first_flagged_at, now),
      item.reason_text,
    ]
      .filter(Boolean)
      .join(" · "),
    href: item.thread_url,
    // New since the last run is what a person scans for when they check back.
    flagged: item.first_flagged_at === nowIso,
    itemId: item.id,
  }));

  const needing = list.filter((item) => item.reason === "needs_reply").length;
  const quiet = list.length - needing;
  if (list.length === 0) {
    return {
      status: "ok",
      headline: `Nothing outstanding — ${plural(issues.considered, "client thread")} checked.`,
      findings: [],
    };
  }

  const parts = [
    needing > 0 ? `${plural(needing, "thread")} waiting on a reply` : null,
    quiet > 0 ? `${quiet} quiet for ${settings.quietAfterDays}+ days` : null,
  ].filter(Boolean);
  const changes = [
    added > 0 ? `${added} new` : null,
    replied > 0 ? `${replied} answered since the last check` : null,
  ].filter(Boolean);

  return {
    status: needing > 0 ? "attention" : "ok",
    headline: `${parts.join(", ")}${changes.length ? ` — ${changes.join(", ")}` : ""}.`,
    findings,
  };
}
