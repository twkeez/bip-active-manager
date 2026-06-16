import { describe, expect, it } from "vitest";
import {
  buildQualityScoreSignals,
  filterActionableKeywords,
  hasQualityIssue,
  summarizeQualityFlags,
} from "@/lib/ads/quality-score";
import type { AdsKeywordQualityRow } from "@/lib/types/client";

function keyword(partial: Partial<AdsKeywordQualityRow>): AdsKeywordQualityRow {
  return {
    campaign_id: "1",
    campaign_name: "Search",
    ad_group_id: "10",
    ad_group_name: "Core",
    criterion_id: "100",
    keyword: "vet clinic",
    match_type: "PHRASE",
    quality_score: 7,
    ad_relevance: "AVERAGE",
    landing_page_experience: "AVERAGE",
    expected_ctr: "AVERAGE",
    impressions: 100,
    clicks: 10,
    cost_micros: 1_000_000,
    conversions: 1,
    ...partial,
  };
}

describe("filterActionableKeywords", () => {
  it("keeps keywords with enough impressions or spend and caps results", () => {
    const rows = [
      keyword({ keyword: "low volume", impressions: 10, cost_micros: 0 }),
      keyword({ keyword: "high spend", impressions: 10, cost_micros: 500_000 }),
      keyword({ keyword: "enough impressions", impressions: 60, cost_micros: 0 }),
    ];
    const filtered = filterActionableKeywords(rows);
    expect(filtered.map((row) => row.keyword)).toEqual([
      "high spend",
      "enough impressions",
    ]);
  });
});

describe("summarizeQualityFlags", () => {
  it("counts below-average components and low QS", () => {
    const summary = summarizeQualityFlags([
      keyword({
        landing_page_experience: "BELOW_AVERAGE",
        cost_micros: 2_000_000,
      }),
      keyword({
        keyword: "other",
        ad_relevance: "BELOW_AVERAGE",
        quality_score: 4,
        cost_micros: 1_000_000,
      }),
    ]);
    expect(summary.landingPageBelowAverage).toBe(1);
    expect(summary.adRelevanceBelowAverage).toBe(1);
    expect(summary.qualityScoreLow).toBe(1);
    expect(summary.flaggedKeywords).toBe(2);
  });
});

describe("buildQualityScoreSignals", () => {
  it("creates rollup and keyword-level signals", () => {
    const signals = buildQualityScoreSignals([
      keyword({
        keyword: "emergency vet",
        landing_page_experience: "BELOW_AVERAGE",
        cost_micros: 842_000_000,
      }),
    ]);
    expect(signals.some((signal) => signal.signal_id === "ads_qs_landing_page_rollup")).toBe(
      true,
    );
    expect(signals.some((signal) => signal.signal_id === "ads_qs_landing_page_weak")).toBe(
      true,
    );
    expect(
      signals.find((signal) => signal.signal_id === "ads_qs_landing_page_weak")?.metric_value,
    ).toContain("emergency vet");
  });
});

describe("hasQualityIssue", () => {
  it("detects below-average components and low quality score", () => {
    expect(hasQualityIssue(keyword({ quality_score: 5 }))).toBe(true);
    expect(hasQualityIssue(keyword({ expected_ctr: "BELOW_AVERAGE" }))).toBe(true);
    expect(hasQualityIssue(keyword({ quality_score: 8 }))).toBe(false);
  });
});
