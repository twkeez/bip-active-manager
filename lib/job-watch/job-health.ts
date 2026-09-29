import type { JobProblem, JobRun } from "./assess";
import type { WatchedJob } from "./jobs";

/** A run with the response the job gave, as job_runs stores it. */
export type JobRunWithDetail = JobRun & { detail: unknown };

export type RunDot = { id: number; startedAt: string; status: JobRun["status"]; summary: string | null };

export type JobHealthRow = {
  key: string;
  name: string;
  schedule: string;
  lastRun: {
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    status: JobRun["status"];
    /** The job's own counts, e.g. "38 synced", "213 blocked". */
    counts: string[];
    summary: string | null;
  } | null;
  /** Newest first, up to 14. */
  recent: RunDot[];
  /** Open problems the watchdog holds against this job (overdue, timed out, failing). */
  problems: string[];
};

// What each count means, in the order it is worth reading. Only counts a job
// actually reported are shown.
const COUNT_LABELS: [path: string, label: string][] = [
  ["synced", "synced"],
  ["failed", "failed"],
  ["blocked", "blocked (no access)"],
  ["deferred", "not reached in time"],
  ["skipped", "not set up"],
  ["sync.syncedProjects", "projects synced"],
  ["sync.failedProjects", "projects failed"],
  ["sync.eventsUpserted", "posts saved"],
  ["classification.classified", "threads classified"],
  ["considered", "considered"],
  ["ran", "ran"],
  ["problems", "problems open"],
  ["newlyReported", "newly emailed"],
];

function pick(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (value, part) => (value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined),
    record,
  );
}

/**
 * The counts a job reported about its run. A large response is stored cut
 * to its first 8,000 characters ({ truncated: "..." }); the counts come
 * first in every job's response, so they are read from that text.
 */
export function runCounts(detail: unknown): string[] {
  if (!detail || typeof detail !== "object") return [];
  const record = detail as Record<string, unknown>;
  const numberAt = (path: string): number | null => {
    if (typeof record.truncated === "string") {
      if (path.includes(".")) return null;
      const match = record.truncated.match(new RegExp(`"${path}":(\\d+)`));
      return match ? Number(match[1]) : null;
    }
    const value = pick(record, path);
    if (typeof value === "number") return value;
    if (Array.isArray(value)) return value.length;
    return null;
  };
  const counts: string[] = [];
  for (const [path, label] of COUNT_LABELS) {
    const value = numberAt(path);
    // Zero failures is worth saying; zero "not set up" is not.
    if (value == null || (value === 0 && !["failed", "synced", "sync.failedProjects"].includes(path))) continue;
    counts.push(`${value.toLocaleString("en-US")} ${label}`);
  }
  return counts;
}

/** One row per watched job: its last run, what that run did, and its recent record. */
export function jobHealthRows(jobs: WatchedJob[], runs: JobRunWithDetail[], problems: JobProblem[]): JobHealthRow[] {
  return jobs.map((job) => {
    const own = runs
      .filter((run) => run.job_key === job.key)
      .sort((a, b) => b.started_at.localeCompare(a.started_at) || b.id - a.id);
    const last = own[0] ?? null;
    return {
      key: job.key,
      name: job.name,
      schedule: job.schedule,
      lastRun: last
        ? {
            startedAt: last.started_at,
            finishedAt: last.finished_at,
            durationMs: last.finished_at
              ? new Date(last.finished_at).getTime() - new Date(last.started_at).getTime()
              : null,
            status: last.status,
            counts: runCounts(last.detail),
            summary: last.summary,
          }
        : null,
      recent: own.slice(0, 14).map((run) => ({
        id: run.id,
        startedAt: run.started_at,
        status: run.status,
        summary: run.summary,
      })),
      problems: problems.filter((problem) => problem.jobKey === job.key).map((problem) => problem.message),
    };
  });
}
