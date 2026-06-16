import { describe, expect, it } from "vitest";
import { buildSmartAdsPlaybook } from "@/lib/ads/smart-playbook";
import type { AdsKeywordQualityRow } from "@/lib/types/client";

function keywordRow(
  overrides: Partial<AdsKeywordQualityRow> & Pick<AdsKeywordQualityRow, "keyword">,
): AdsKeywordQualityRow {
  return {
    campaign_id: "1",
    campaign_name: "Search",
    ad_group_id: "10",
    ad_group_name: "Grove City",
    criterion_id: "100",
    match_type: "PHRASE",
    quality_score: 4,
    ad_relevance: "AVERAGE",
    landing_page_experience: "AVERAGE",
    expected_ctr: "AVERAGE",
    impressions: 100,
    clicks: 10,
    cost_micros: 500_000,
    conversions: 1,
    ...overrides,
  };
}

describe("buildSmartAdsPlaybook", () => {
  it("groups below-average ad relevance keywords into one task", () => {
    const tasks = buildSmartAdsPlaybook({
      keywordQuality: [
        keywordRow({ keyword: "dog medicine", ad_relevance: "BELOW_AVERAGE" }),
        keywordRow({
          keyword: "veterinarian near me",
          ad_relevance: "BELOW_AVERAGE",
          criterion_id: "101",
        }),
      ],
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.kind).toBe("ad_relevance");
    if (tasks[0]?.kind === "ad_relevance") {
      expect(tasks[0].keywords).toEqual(["dog medicine", "veterinarian near me"]);
    }
  });

  it("groups below-average expected CTR keywords into one task", () => {
    const tasks = buildSmartAdsPlaybook({
      keywordQuality: [
        keywordRow({ keyword: "vets grove city", expected_ctr: "BELOW_AVERAGE" }),
      ],
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.kind).toBe("expected_ctr");
    if (tasks[0]?.kind === "expected_ctr") {
      expect(tasks[0].keywords).toEqual(["vets grove city"]);
      expect(tasks[0].adGroupNames).toEqual(["Grove City"]);
    }
  });

  it("adds a budget task when lost IS (budget) exceeds 10%", () => {
    const tasks = buildSmartAdsPlaybook({
      keywordQuality: [],
      searchBudgetLostImpressionShare: 0.3,
      averageCpc: 2.19,
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      kind: "budget",
      lostImpressionSharePct: 30,
      averageCpc: 2.19,
    });
  });

  it("skips budget task at or below 10% lost IS", () => {
    const tasks = buildSmartAdsPlaybook({
      keywordQuality: [],
      searchBudgetLostImpressionShare: 0.1,
    });

    expect(tasks).toHaveLength(0);
  });
});
