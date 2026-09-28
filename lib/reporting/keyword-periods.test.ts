import { describe, expect, it } from "vitest";
import { pickKeywordPeriods, previousWindowFor } from "./keyword-periods";

const snap = (id: number, start: string, end: string, run_status = "completed") => ({
  id,
  start_date: start,
  end_date: end,
  run_status,
  created_at: `${end}T12:00:00Z`,
});

describe("pickKeywordPeriods", () => {
  it("takes the newest completed snapshot as current and the one just before its window as previous", () => {
    const snapshots = [
      snap(3, "2026-08-30", "2026-09-26"),
      snap(2, "2026-08-29", "2026-09-25"), // overlaps: never the previous period
      snap(1, "2026-08-02", "2026-08-29"),
    ];
    const { current, previous } = pickKeywordPeriods(snapshots);
    expect(current?.id).toBe(3);
    expect(previous?.id).toBe(1);
  });

  it("has no previous period when nothing covers the 28 days before", () => {
    const { previous } = pickKeywordPeriods([snap(3, "2026-08-30", "2026-09-26"), snap(9, "2026-06-10", "2026-07-07")]);
    expect(previous).toBeNull();
  });

  it("tolerates a skipped night either side, and ignores failed runs", () => {
    const { current, previous } = pickKeywordPeriods([
      snap(4, "2026-09-01", "2026-09-28", "failed"),
      snap(3, "2026-08-30", "2026-09-26"),
      snap(1, "2026-07-31", "2026-08-27"),
    ]);
    expect(current?.id).toBe(3);
    expect(previous?.id).toBe(1);
  });
});

describe("previousWindowFor", () => {
  it("is the same length, ending the day before the current window starts", () => {
    expect(previousWindowFor({ start_date: "2026-08-30", end_date: "2026-09-26" })).toEqual({
      startDate: "2026-08-02",
      endDate: "2026-08-29",
    });
  });
});

describe("keyword rows in the client report", () => {
  it("shows one period's clicks, never a sum of snapshots, and blanks what Google has no row for", async () => {
    const { buildKeywordSection } = await import("./build-report");
    const section = buildKeywordSection({
      managedKeywords: [
        { keyword: "Bayside Animal Hospital", tag: null, priority: 1, isActive: true },
        { keyword: "exotic vet bayside", tag: null, priority: 2, isActive: true },
      ] as never,
      gscQueryMetrics: [
        { query: "Bayside Animal Hospital", clicks: 13, impressions: 200, position: 1.4, period: "current" },
        { query: "bayside animal hospital", clicks: 10, impressions: 180, position: 1.9, period: "previous" },
      ],
    });
    const [bayside, exotic] = section.rows;
    expect(bayside).toMatchObject({ currentClicks: 13, previousClicks: 10, currentPosition: 1.4 });
    expect(bayside.positionDelta).toBeCloseTo(-0.5);
    expect(exotic).toMatchObject({ currentClicks: null, previousClicks: null, currentPosition: null });
  });
});
