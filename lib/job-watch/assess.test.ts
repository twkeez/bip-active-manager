import { describe, expect, it } from "vitest";
import { assessJobs, jobStatusLines, type JobRun } from "./assess";
import type { WatchedJob } from "./jobs";

const JOBS: WatchedJob[] = [
  { key: "ads-sync", name: "Google Ads sync", schedule: "nightly", overdueAfterHours: 30 },
  { key: "routines", name: "Routines", schedule: "hourly", overdueAfterHours: 26 },
];
const NOW = new Date("2026-09-26T15:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const WATCHING = new Date(hoursAgo(100));

let nextId = 1;
function run(overrides: Partial<JobRun>): JobRun {
  return {
    id: nextId++,
    job_key: "ads-sync",
    started_at: hoursAgo(2),
    finished_at: hoursAgo(1.9),
    status: "ok",
    http_status: 200,
    summary: null,
    ...overrides,
  };
}

describe("assessJobs", () => {
  it("is quiet when every job ran recently and worked", () => {
    const runs = [run({}), run({ job_key: "routines", started_at: hoursAgo(1) })];
    expect(assessJobs(JOBS, runs, NOW, WATCHING)).toEqual([]);
  });

  it("reports a failed run with its reason", () => {
    const failed = run({ status: "failed", http_status: 500, summary: "Token expired." });
    const problems = assessJobs(JOBS, [failed, run({ job_key: "routines" })], NOW, WATCHING);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ key: `run:${failed.id}`, kind: "failed" });
    expect(problems[0].message).toContain("Token expired.");
  });

  it("reports a partial run", () => {
    const partial = run({ status: "partial", http_status: 207, summary: "3 items failed." });
    const problems = assessJobs(JOBS, [partial, run({ job_key: "routines" })], NOW, WATCHING);
    expect(problems.map((p) => p.kind)).toEqual(["partial"]);
  });

  it("reports a run that never finished as timed out, but not one still inside the limit", () => {
    const stuck = run({ status: "running", finished_at: null, started_at: hoursAgo(1) });
    const fresh = run({ job_key: "routines", status: "running", finished_at: null, started_at: new Date(NOW.getTime() - 2 * 60_000).toISOString() });
    const problems = assessJobs(JOBS, [stuck, fresh], NOW, WATCHING);
    expect(problems.map((p) => [p.kind, p.key])).toEqual([["timed_out", `timeout:${stuck.id}`]]);
  });

  it("reports a job that has not run within its threshold, once per stall", () => {
    const old = run({ started_at: hoursAgo(31) });
    const problems = assessJobs(JOBS, [old, run({ job_key: "routines" })], NOW, WATCHING);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ kind: "overdue", key: `overdue:ads-sync:${old.started_at}` });
  });

  it("reports a job that never ran, but only once tracking has been live long enough", () => {
    const routinesOnly = [run({ job_key: "routines" })];
    expect(assessJobs(JOBS, routinesOnly, NOW, new Date(hoursAgo(5)))).toEqual([]);
    const problems = assessJobs(JOBS, routinesOnly, NOW, WATCHING);
    expect(problems.map((p) => p.key)).toEqual(["overdue:ads-sync:never"]);
  });

  it("ignores failures older than the lookback window", () => {
    const ancient = run({ status: "failed", started_at: hoursAgo(72) });
    const problems = assessJobs(JOBS, [ancient, run({}), run({ job_key: "routines" })], NOW, WATCHING);
    expect(problems).toEqual([]);
  });
});

describe("jobStatusLines", () => {
  it("names each job's last run and outcome", () => {
    const lines = jobStatusLines(JOBS, [run({ status: "partial" })], NOW);
    expect(lines).toEqual(["Google Ads sync: last ran 2h ago, partly failed", "Routines: no run recorded yet"]);
  });
});
