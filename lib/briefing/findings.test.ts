import { describe, expect, it } from "vitest";
import {
  compare,
  needsAttention,
  postingGapFinding,
  largestNumber,
  rankFindings,
  reviewFindings,
  signalFindings,
  type StoredSignal,
} from "./findings";

describe("compare", () => {
  it("reports a real drop as something to act on", () => {
    const finding = compare({
      id: "ads:calls",
      scope: "ppc",
      period: { current: 12, previous: 30 },
      floor: 5,
      noun: "calls from ads",
    });
    expect(finding).toMatchObject({ level: "needs_you", metric: "30 → 12" });
    expect(finding?.headline).toBe("Calls from ads down 60% on the previous month");
  });

  // The rule that keeps a fortnightly note worth opening.
  it("says nothing about a big percentage off a tiny number", () => {
    expect(
      compare({ id: "x", scope: "ppc", period: { current: 1, previous: 3 }, floor: 5, noun: "calls" }),
    ).toBeNull();
  });

  it("ignores a change too small to matter", () => {
    expect(
      compare({ id: "x", scope: "seo", period: { current: 92, previous: 100 }, floor: 40, noun: "clicks" }),
    ).toBeNull();
  });

  it("carries good news too", () => {
    expect(
      compare({ id: "x", scope: "seo", period: { current: 140, previous: 100 }, floor: 40, noun: "clicks" }),
    ).toMatchObject({ level: "good" });
  });

  it("knows which direction is bad for a cost", () => {
    expect(
      compare({
        id: "x",
        scope: "ppc",
        period: { current: 80, previous: 50 },
        floor: 10,
        noun: "cost per call",
        fallingIsBad: false,
      }),
    ).toMatchObject({ level: "needs_you" });
  });

  it("does not divide by a period that did not exist", () => {
    expect(
      compare({ id: "x", scope: "ppc", period: { current: 60, previous: 0 }, floor: 5, noun: "calls" }),
    ).toBeNull();
  });
});

describe("signalFindings", () => {
  const signal = (id: string, severity: "critical" | "watch"): StoredSignal => ({
    signal_id: id,
    severity,
    title: `${id} happened`,
  });

  it("puts critical first, caps the list and never repeats a signal", () => {
    const findings = signalFindings(
      [signal("a", "watch"), signal("b", "critical"), signal("b", "critical"), signal("c", "critical")],
      "ppc",
    );
    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.id)).toEqual(["signal:ppc:b", "signal:ppc:c"]);
    expect(findings[0].level).toBe("needs_you");
  });

  it("maps a watch signal to something to keep an eye on", () => {
    expect(signalFindings([signal("a", "watch")], "seo")[0]).toMatchObject({ level: "watch" });
  });
});

describe("signal floors", () => {
  // The finding that made this necessary: true, and worthless.
  it("drops a volume signal whose numbers are tiny", () => {
    const findings = signalFindings(
      [
        {
          signal_id: "reach_drop_week_over_week",
          severity: "watch",
          title: "Reach dropped week-over-week",
          metric_value: "50.0% drop (5 vs 10)",
        },
      ],
      "smm",
    );
    expect(findings).toEqual([]);
  });

  it("keeps the same signal when the numbers are real", () => {
    const findings = signalFindings(
      [
        {
          signal_id: "reach_drop_week_over_week",
          severity: "watch",
          title: "Reach dropped week-over-week",
          metric_value: "38% drop (1,240 vs 2,000)",
        },
      ],
      "smm",
    );
    expect(findings).toHaveLength(1);
  });

  it("reads the size from the metric, not the percentage", () => {
    expect(largestNumber("50.0% drop (5 vs 10)")).toBe(10);
    expect(largestNumber("$764.81 spend (30d)")).toBe(764.81);
    expect(largestNumber(null)).toBeNull();
  });

  it("lets signals that are not about volume through", () => {
    const findings = signalFindings(
      [{ signal_id: "ads_no_conversions", severity: "critical", title: "No conversions", metric_value: "0 conversions" }],
      "ppc",
    );
    expect(findings).toHaveLength(1);
  });
});

describe("reviewFindings", () => {
  const nowMs = Date.parse("2026-09-17T00:00:00Z");
  const daysAgo = (days: number) => Math.floor((nowMs - days * 86_400_000) / 1000);

  it("raises a recent poor review as needing a reply", () => {
    const findings = reviewFindings({
      rating: 4.6,
      previousRating: 4.6,
      reviewCount: 120,
      previousReviewCount: 119,
      reviews: [{ author_name: "Dana", rating: 1, review_time_unix: daysAgo(3) }],
      now: nowMs,
    });
    expect(findings[0]).toMatchObject({ level: "needs_you", id: "reviews:poor" });
    expect(findings[0].detail).toContain("Dana");
  });

  it("leaves an old poor review alone", () => {
    const findings = reviewFindings({
      rating: 4.6,
      previousRating: 4.6,
      reviewCount: 120,
      previousReviewCount: 120,
      reviews: [{ author_name: "Dana", rating: 1, review_time_unix: daysAgo(200) }],
      now: nowMs,
    });
    expect(findings).toEqual([]);
  });

  it("notices the rating moving, both ways", () => {
    expect(
      reviewFindings({ rating: 4.3, previousRating: 4.6, reviewCount: null, previousReviewCount: null, reviews: [], now: nowMs })[0],
    ).toMatchObject({ level: "watch", metric: "4.6 → 4.3" });
    expect(
      reviewFindings({ rating: 4.9, previousRating: 4.6, reviewCount: null, previousReviewCount: null, reviews: [], now: nowMs })[0],
    ).toMatchObject({ level: "good" });
  });

  // Congratulating a practice on new reviews in the same breath as a one-star
  // complaint reads as if nobody looked.
  it("does not celebrate new reviews while one needs a reply", () => {
    const findings = reviewFindings({
      rating: 4.6,
      previousRating: 4.6,
      reviewCount: 130,
      previousReviewCount: 120,
      reviews: [{ rating: 1, review_time_unix: daysAgo(2) }],
      now: nowMs,
    });
    expect(findings.map((finding) => finding.id)).toEqual(["reviews:poor"]);
  });
});

describe("postingGapFinding", () => {
  const nowMs = Date.parse("2026-09-17T00:00:00Z");
  it("escalates with the length of the silence", () => {
    expect(postingGapFinding({ lastPostAt: "2026-09-14T00:00:00Z", now: nowMs })).toBeNull();
    expect(postingGapFinding({ lastPostAt: "2026-08-30T00:00:00Z", now: nowMs })).toMatchObject({
      level: "watch",
    });
    expect(postingGapFinding({ lastPostAt: "2026-08-01T00:00:00Z", now: nowMs })).toMatchObject({
      level: "needs_you",
    });
  });

  // Never posted is not the same as stopped posting; that is a blind spot.
  it("says nothing when there is no post to measure from", () => {
    expect(postingGapFinding({ lastPostAt: null, now: nowMs })).toBeNull();
  });
});

describe("rankFindings", () => {
  const finding = (id: string, level: "needs_you" | "watch" | "good") => ({
    id,
    scope: "account" as const,
    level,
    headline: id,
  });

  it("leads with what needs doing and keeps room for one good thing", () => {
    const ranked = rankFindings([
      finding("good", "good"),
      finding("watch", "watch"),
      finding("urgent", "needs_you"),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["urgent", "watch", "good"]);
  });

  it("still finds room for good news when three problems are queued", () => {
    const ranked = rankFindings([
      finding("a", "needs_you"),
      finding("b", "needs_you"),
      finding("c", "needs_you"),
      finding("d", "needs_you"),
      finding("good", "good"),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["a", "b", "good"]);
  });

  it("carries good news alone when that is all there is", () => {
    const ranked = rankFindings([finding("good", "good")]);
    expect(ranked.map((item) => item.id)).toEqual(["good"]);
    expect(needsAttention(ranked)).toBe(false);
  });
});
