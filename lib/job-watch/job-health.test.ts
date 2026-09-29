import { describe, expect, it } from "vitest";
import { jobHealthRows, runCounts, type JobRunWithDetail } from "./job-health";
import type { WatchedJob } from "./jobs";

describe("runCounts", () => {
  it("reads a nightly sync's counts, skipping empty ones but keeping zero failures", () => {
    expect(runCounts({ ok: true, synced: 88, failed: 0, blocked: 0, skipped: 168, deferred: 0, results: [] })).toEqual([
      "88 synced",
      "0 failed",
      "168 not set up",
    ]);
  });

  it("reads counts from a response stored cut short", () => {
    const detail = { truncated: '{"ok":true,"synced":32,"failed":0,"blocked":213,"skipped":11,"deferred":0,"results":[{"clientId":338' };
    expect(runCounts(detail)).toEqual(["32 synced", "0 failed", "213 blocked (no access)", "11 not set up"]);
  });

  it("reads the Basecamp watch's nested counts", () => {
    const detail = {
      ok: true,
      sync: { syncedProjects: 180, failedProjects: [], eventsUpserted: 42 },
      classification: { classified: 7 },
    };
    expect(runCounts(detail)).toEqual(["180 projects synced", "0 projects failed", "42 posts saved", "7 threads classified"]);
  });

  it("says nothing when the job reported nothing", () => {
    expect(runCounts(null)).toEqual([]);
  });
});

describe("jobHealthRows", () => {
  const jobs: WatchedJob[] = [
    { key: "ads-sync", name: "Google Ads sync", schedule: "nightly", overdueAfterHours: 26 },
    { key: "routines", name: "Routines", schedule: "hourly", overdueAfterHours: 3 },
  ];
  const run = (id: number, startedAt: string, status: JobRunWithDetail["status"], detail: unknown = null): JobRunWithDetail => ({
    id,
    job_key: "ads-sync",
    started_at: startedAt,
    finished_at: new Date(new Date(startedAt).getTime() + 90_000).toISOString(),
    status,
    http_status: status === "ok" ? 200 : 207,
    summary: status === "ok" ? null : "2 items failed.",
    detail,
  });

  it("shows each job's newest run, its record, and a job that never ran", () => {
    const rows = jobHealthRows(
      jobs,
      [run(1, "2026-09-27T07:10:00Z", "partial"), run(2, "2026-09-28T07:10:00Z", "ok", { synced: 38, failed: 0 })],
      [{ key: "x", jobKey: "routines", kind: "overdue", message: "Routines has not run." }],
    );
    expect(rows[0].lastRun).toMatchObject({ status: "ok", durationMs: 90_000, counts: ["38 synced", "0 failed"] });
    expect(rows[0].recent.map((dot) => dot.status)).toEqual(["ok", "partial"]);
    expect(rows[1]).toMatchObject({ lastRun: null, recent: [], problems: ["Routines has not run."] });
  });
});
