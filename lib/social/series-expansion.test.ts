import { describe, expect, it } from "vitest";
import { expandSeries } from "@/lib/social/series-expansion";
import type { SocialSeriesWithParts } from "@/lib/social/types";

function series(partial: Partial<SocialSeriesWithParts>): SocialSeriesWithParts {
  return {
    id: 1,
    client_id: null,
    title: "Test Series",
    description: "",
    kind: "recurring",
    campaign_type: "series",
    purpose: null,
    tags: [],
    cadence: "weekly",
    day_of_week: 5,
    spacing_days: null,
    is_active: true,
    created_by: null,
    created_at: "",
    updated_at: "",
    parts: [],
    ...partial,
  } as SocialSeriesWithParts;
}

function part(n: number, title: string, shot: string | null = null) {
  return {
    id: n,
    series_id: 1,
    part_number: n,
    title,
    description: "",
    suggested_shot: shot,
    created_at: "",
    updated_at: "",
  };
}

describe("expandSeries — recurring", () => {
  it("weekly fills every matching weekday in the month", () => {
    // Fridays in November 2026: 6, 13, 20, 27.
    const s = series({ cadence: "weekly", day_of_week: 5 });
    const out = expandSeries(s, "2026-11-06", 2026, 11);
    expect(out.posts.map((p) => p.postDate)).toEqual([
      "2026-11-06", "2026-11-13", "2026-11-20", "2026-11-27",
    ]);
    expect(out.clipped).toBe(0);
    expect(out.posts.every((p) => p.campaignLabel === "Test Series")).toBe(true);
    expect(out.posts.every((p) => p.seriesPart === null)).toBe(true);
  });

  it("weekly ignores where in the month it was dropped", () => {
    const s = series({ cadence: "weekly", day_of_week: 5 });
    const dropLate = expandSeries(s, "2026-11-27", 2026, 11);
    expect(dropLate.posts).toHaveLength(4);
  });

  it("biweekly starts at the first occurrence on or after the drop", () => {
    const s = series({ cadence: "biweekly", day_of_week: 5 });
    // Dropped on the 6th → 6, 20.
    expect(expandSeries(s, "2026-11-06", 2026, 11).posts.map((p) => p.postDate))
      .toEqual(["2026-11-06", "2026-11-20"]);
    // Dropped mid-week before the 13th → 13, 27.
    expect(expandSeries(s, "2026-11-10", 2026, 11).posts.map((p) => p.postDate))
      .toEqual(["2026-11-13", "2026-11-27"]);
  });

  it("monthly creates exactly one post on the drop date", () => {
    const s = series({ cadence: "monthly", day_of_week: null });
    const out = expandSeries(s, "2026-11-18", 2026, 11);
    expect(out.posts).toEqual([
      { postDate: "2026-11-18", campaignLabel: "Test Series", seriesPart: null, shotList: "" },
    ]);
  });

  it("falls back to the dropped weekday when day_of_week is unset", () => {
    const s = series({ cadence: "weekly", day_of_week: null });
    // 2026-11-04 is a Wednesday → Wednesdays: 4, 11, 18, 25.
    expect(expandSeries(s, "2026-11-04", 2026, 11).posts.map((p) => p.postDate))
      .toEqual(["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25"]);
  });
});

describe("expandSeries — arc", () => {
  const arc = series({
    kind: "arc",
    cadence: null,
    day_of_week: null,
    spacing_days: 7,
    title: "Dental Month",
    parts: [part(1, "Why it matters", "Close-up of teeth"), part(2, "The visit"), part(3, "Aftercare")],
  });

  it("spaces parts by spacing_days and labels them", () => {
    const out = expandSeries(arc, "2026-11-02", 2026, 11);
    expect(out.posts).toEqual([
      { postDate: "2026-11-02", campaignLabel: "Dental Month: Why it matters", seriesPart: 1, shotList: "Close-up of teeth" },
      { postDate: "2026-11-09", campaignLabel: "Dental Month: The visit", seriesPart: 2, shotList: "" },
      { postDate: "2026-11-16", campaignLabel: "Dental Month: Aftercare", seriesPart: 3, shotList: "" },
    ]);
    expect(out.clipped).toBe(0);
  });

  it("clips parts that would land in the next month", () => {
    // Dropped on the 23rd: parts land 23 Nov, 30 Nov, 7 Dec — the third is clipped.
    const out = expandSeries(arc, "2026-11-23", 2026, 11);
    expect(out.posts.map((p) => p.postDate)).toEqual(["2026-11-23", "2026-11-30"]);
    expect(out.totalWanted).toBe(3);
    expect(out.clipped).toBe(1);
  });

  it("respects part_number order regardless of array order", () => {
    const shuffled = series({
      kind: "arc", cadence: null, day_of_week: null, spacing_days: 1, title: "A",
      parts: [part(3, "Third"), part(1, "First"), part(2, "Second")],
    });
    expect(expandSeries(shuffled, "2026-11-02", 2026, 11).posts.map((p) => p.campaignLabel))
      .toEqual(["A: First", "A: Second", "A: Third"]);
  });

  it("clips everything when the whole arc falls outside the month", () => {
    const out = expandSeries(arc, "2026-11-30", 2026, 11);
    expect(out.posts.map((p) => p.postDate)).toEqual(["2026-11-30"]);
    expect(out.clipped).toBe(2);
  });
});
