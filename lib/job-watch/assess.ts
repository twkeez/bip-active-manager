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
  kind: "failed" | "partial" | "timed_out" | "overdue";
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

  for (const run of runs) {
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
    } else if (run.status === "failed") {
      problems.push({
        key: `run:${run.id}`,
        jobKey: run.job_key,
        kind: "failed",
        message: `${name} failed (${when}).${why}`,
      });
    } else if (run.status === "partial") {
      problems.push({
        key: `run:${run.id}`,
        jobKey: run.job_key,
        kind: "partial",
        message: `${name} only partly worked (${when}).${why}`,
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
