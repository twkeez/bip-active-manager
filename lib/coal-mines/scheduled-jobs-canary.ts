import type { SupabaseClient } from "@supabase/supabase-js";
import { jobStatusLines } from "@/lib/job-watch/assess";
import { WATCHED_JOBS } from "@/lib/job-watch/jobs";
import { loadJobState } from "@/lib/job-watch/run-watch";
import type { Canary } from "./canaries";

/**
 * Every scheduled job at once: which failed, partly failed, timed out or did
 * not run. The same findings the hourly watchdog emails, here so they are
 * visible even when an email could not be sent.
 */
export async function checkScheduledJobs(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Canary> {
  const base = {
    key: "scheduled-jobs",
    name: "Scheduled jobs",
    watches:
      "Every nightly and hourly job: whether each one ran, finished, and worked. Problems are also emailed to Tom.",
    action: { label: "GitHub Actions runs", href: "https://github.com/twkeez/bip-active-manager/actions" },
  } as const;

  let state: Awaited<ReturnType<typeof loadJobState>>;
  try {
    state = await loadJobState(supabase, now);
  } catch (error) {
    return {
      ...base,
      status: "attention",
      headline: "Cannot read the job run log.",
      detail: [
        error instanceof Error ? error.message : "Unknown error.",
        "If the table is missing, run supabase/migrations/20260926120000_job_runs.sql.",
      ],
    };
  }

  const { runs, problems } = state;
  const lines = jobStatusLines(WATCHED_JOBS, runs, now);
  if (problems.length === 0) {
    return {
      ...base,
      status: "ok",
      headline: runs.length ? "Every scheduled job is running and working." : "Recording has just started. No runs yet.",
      detail: lines,
    };
  }
  const serious = problems.some((problem) => problem.kind !== "partial");
  return {
    ...base,
    status: serious ? "overdue" : "attention",
    headline: `${problems.length} scheduled job ${problems.length === 1 ? "problem" : "problems"} in the last two days.`,
    detail: [...problems.map((problem) => problem.message), ...lines],
  };
}
