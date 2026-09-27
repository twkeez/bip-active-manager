import type { SupabaseClient } from "@supabase/supabase-js";
import { jobName } from "@/lib/job-watch/jobs";
import { REMINDER_TIMEZONE } from "./plan";
import { zonedTime } from "@/lib/routines/schedule";

/**
 * The nightly syncs a briefing reads. Reminders go out only once every one of
 * them has finished that morning (Tom, 2026-09-26: "This data needs to be
 * accurate"). A partly failed sync counts as finished: its gaps show in the
 * briefing as blind spots rather than stale numbers.
 */
export const BRIEFING_SOURCES = ["ads-sync", "social-sync", "seo-sync", "ga4-sync", "gbp-sync"];

type SyncRun = { job_key: string; started_at: string; status: string };

/** Which sources have not finished a run since the start of the run's day. */
export function staleSources(runs: SyncRun[], dayStart: Date, sources = BRIEFING_SOURCES): string[] {
  return sources.filter(
    (key) =>
      !runs.some(
        (run) =>
          run.job_key === key &&
          (run.status === "ok" || run.status === "partial") &&
          new Date(run.started_at).getTime() >= dayStart.getTime(),
      ),
  );
}

/** Midnight Eastern at the start of a run date (YYYY-MM-DD). */
export function runDayStart(runDate: string): Date {
  const [year, month, day] = runDate.split("-").map(Number);
  return zonedTime(REMINDER_TIMEZONE, { year, month, day }, 0, 0);
}

/** The syncs that have not finished today, by name, or [] when all are fresh. */
export async function checkSourcesFresh(admin: SupabaseClient, runDate: string): Promise<string[]> {
  const dayStart = runDayStart(runDate);
  const { data, error } = await admin
    .from("job_runs")
    .select("job_key, started_at, status")
    .in("job_key", BRIEFING_SOURCES)
    .gte("started_at", dayStart.toISOString());
  if (error) throw new Error(`Could not check whether today's data synced: ${error.message}`);
  return staleSources((data ?? []) as SyncRun[], dayStart).map(jobName);
}
