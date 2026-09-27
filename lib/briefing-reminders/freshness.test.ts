import { describe, expect, it } from "vitest";
import { runDayStart, staleSources } from "./freshness";

describe("staleSources", () => {
  const dayStart = runDayStart("2026-10-05");

  it("starts the day at midnight Eastern", () => {
    expect(dayStart.toISOString()).toBe("2026-10-05T04:00:00.000Z");
  });

  it("is empty when every source finished (or partly finished) this morning", () => {
    const runs = ["ads-sync", "social-sync", "seo-sync", "ga4-sync"].map((job_key) => ({
      job_key,
      started_at: "2026-10-05T07:10:00Z",
      status: "ok",
    }));
    runs.push({ job_key: "gbp-sync", started_at: "2026-10-05T09:10:00Z", status: "partial" });
    expect(staleSources(runs, dayStart)).toEqual([]);
  });

  it("names sources that failed, are still running, or last ran yesterday", () => {
    const runs = [
      { job_key: "ads-sync", started_at: "2026-10-05T07:10:00Z", status: "failed" },
      { job_key: "social-sync", started_at: "2026-10-05T07:40:00Z", status: "running" },
      { job_key: "seo-sync", started_at: "2026-10-04T08:10:00Z", status: "ok" },
      { job_key: "ga4-sync", started_at: "2026-10-05T08:40:00Z", status: "ok" },
      { job_key: "gbp-sync", started_at: "2026-10-05T09:10:00Z", status: "ok" },
    ];
    expect(staleSources(runs, dayStart)).toEqual(["ads-sync", "social-sync", "seo-sync"]);
  });
});
