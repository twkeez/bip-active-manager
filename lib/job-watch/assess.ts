import { TIMEOUT_AFTER_MINUTES, type WatchedJob } from "./jobs";

export type JobRun = {
  id: number;
  job_key: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "partial" | "failed";
  http_status: number | null;
  summary: string | null;
};

export type JobProblem = {
  /** Stable per problem, so it is reported once, not every hour. */
  key: string;
  jobKey: string;
  kind: "failed" | "partial" | "timed_out" | "overdue" | "data_warning" | "credential";
  message: string;
};

const HOUR = 3_600_000;

/** Only recent runs raise alerts; a failure from last week was already reported. */
export const LOOKBACK_HOURS = 48;

function ago(from: Date, iso: string): string {
  const hours = (from.getTime() - new Date(iso).getTime()) / HOUR;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/**
 * The same problem, night after night, is one alert, not one per run.
 *
 * A run's fingerprint is its status plus its summary with the numbers taken
 * out ("216 failed" and "214 failed" match). Consecutive finished runs of a
 * job with the same fingerprint form a streak, keyed by its first run, so Tom
 * hears once when it starts, again if the problem changes, and again if it
 * comes back after a clean run. (GBP's "216 failed" emailed every night.)
 */
export function streakOf(runs: JobRun[]): Map<number, { key: string; runsInARow: number }> {
  const byJob = new Map<string, JobRun[]>();
  for (const run of runs) {
    if (run.status === "running") continue;
    byJob.set(run.job_key, [...(byJob.get(run.job_key) ?? []), run]);
  }
  const streaks = new Map<number, { key: string; runsInARow: number }>();
  for (const [jobKey, jobRuns] of byJob) {
    jobRuns.sort((a, b) => a.started_at.localeCompare(b.started_at) || a.id - b.id);
    let fingerprint: string | null = null;
    let members: JobRun[] = [];
    const close = () => {
      for (const member of members) {
        streaks.set(member.id, { key: `streak:${jobKey}:${members[0].id}`, runsInARow: members.length });
      }
      members = [];
    };
    for (const run of jobRuns) {
      const next =
        run.status === "ok" ? null : `${run.status}|${(run.summary ?? "").replace(/\d+/g, "#").trim()}`;
      if (next !== fingerprint) close();
      fingerprint = next;
      if (next) members.push(run);
    }
    close();
  }
  return streaks;
}

/**
 * Everything that went wrong with the scheduled jobs: runs that failed, partly
 * failed or never finished, and jobs that have not run when they should have.
 *
 * `watchingSince` is when run recording began. A job with no recorded run is
 * only overdue once recording has been live longer than its threshold;
 * otherwise every job would read as "never ran" the day this ships.
 */
export function assessJobs(
  jobs: WatchedJob[],
  runs: JobRun[],
  now: Date,
  watchingSince: Date | null,
): JobProblem[] {
  const problems: JobProblem[] = [];
  const recentCutoff = now.getTime() - LOOKBACK_HOURS * HOUR;
  const streaks = streakOf(runs);
  // Runs arrive newest first; one problem per streak, worded from its latest run.
  const reportedStreaks = new Set<string>();

  const newestFirst = [...runs].sort((a, b) => b.started_at.localeCompare(a.started_at) || b.id - a.id);
  for (const run of newestFirst) {
    const started = new Date(run.started_at).getTime();
    if (started < recentCutoff) continue;
    const name = jobs.find((job) => job.key === run.job_key)?.name ?? run.job_key;
    const when = ago(now, run.started_at);
    const why = run.summary ? ` ${run.summary}` : "";

    if (run.status === "running") {
      if (now.getTime() - started > TIMEOUT_AFTER_MINUTES * 60_000) {
        problems.push({
          key: `timeout:${run.id}`,
          jobKey: run.job_key,
          kind: "timed_out",
          message: `${name} started ${when} and never finished. It was most likely stopped at the 5-minute limit, so its work may be incomplete.`,
        });
      }
    } else if (run.status === "failed" || run.status === "partial") {
      const streak = streaks.get(run.id);
      const key = streak?.key ?? `run:${run.id}`;
      if (reportedStreaks.has(key)) continue;
      reportedStreaks.add(key);
      const repeat = streak && streak.runsInARow > 1 ? ` Same problem ${streak.runsInARow} runs in a row.` : "";
      problems.push({
        key,
        jobKey: run.job_key,
        kind: run.status,
        message:
          run.status === "failed"
            ? `${name} failed (${when}).${why}${repeat}`
            : `${name} only partly worked (${when}).${why}${repeat}`,
      });
    }
  }

  for (const job of jobs) {
    const latest = runs
      .filter((run) => run.job_key === job.key)
      .reduce<JobRun | null>(
        (best, run) => (!best || run.started_at > best.started_at ? run : best),
        null,
      );
    const limit = job.overdueAfterHours * HOUR;
    if (latest) {
      if (now.getTime() - new Date(latest.started_at).getTime() > limit) {
        problems.push({
          key: `overdue:${job.key}:${latest.started_at}`,
          jobKey: job.key,
          kind: "overdue",
          message: `${job.name} has not run since ${ago(now, latest.started_at)}. It should run ${job.schedule}.`,
        });
      }
    } else if (watchingSince && now.getTime() - watchingSince.getTime() > limit) {
      problems.push({
        key: `overdue:${job.key}:never`,
        jobKey: job.key,
        kind: "overdue",
        message: `${job.name} has not run at all since run tracking began (${ago(now, watchingSince.toISOString())}). It should run ${job.schedule}.`,
      });
    }
  }

  return problems;
}

/** One line per job for the daily summary: when it last ran and how it went. */
export function jobStatusLines(jobs: WatchedJob[], runs: JobRun[], now: Date): string[] {
  return jobs.map((job) => {
    const latest = runs
      .filter((run) => run.job_key === job.key)
      .reduce<JobRun | null>(
        (best, run) => (!best || run.started_at > best.started_at ? run : best),
        null,
      );
    if (!latest) return `${job.name}: no run recorded yet`;
    const label =
      latest.status === "ok"
        ? "worked"
        : latest.status === "partial"
          ? "partly failed"
          : latest.status === "failed"
            ? "FAILED"
            : "still running";
    return `${job.name}: last ran ${ago(now, latest.started_at)}, ${label}`;
  });
}
