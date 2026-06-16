import { describe, expect, it } from "vitest";
import { buildAdsAuditReport } from "@/lib/ads/audit";
import type { AdsAuditSupplement } from "@/lib/ads/audit-fetch";
import type { AdsSyncResult } from "@/lib/ads/google-ads";

const emptySupplement: AdsAuditSupplement = {
  searchTerms: [],
  devices: [],
  geography: [],
  schedule: [],
  campaigns: [],
  conversionActions: [],
};

function baseSync(overrides: Partial<AdsSyncResult> = {}): AdsSyncResult {
  return {
    customerId: "1234567890",
    startDate: "2026-04-20",
    endDate: "2026-05-20",
    totals: {
      impressions: 21000,
      clicks: 1840,
      cost_micros: 11_514_000_000,
      conversions: 457,
      ctr: 0.0875,
      average_cpc: 6_250_000,
      search_impression_share: null,
      search_rank_lost_impression_share: null,
      search_budget_lost_impression_share: null,
    },
    campaigns: [],
    auctionInsights: [],
    keywordQuality: [],
    ...overrides,
  };
}

describe("buildAdsAuditReport", () => {
  it("builds executive snapshot and match type warning for broad-heavy accounts", () => {
    const report = buildAdsAuditReport({
      accountName: "Rocklin Ranch Veterinary Hospital",
      sync: baseSync({
        keywordQuality: [
          {
            campaign_id: "1",
            campaign_name: "Search",
            ad_group_id: "10",
            ad_group_name: "Core",
            criterion_id: "1",
            keyword: "emergency vet near me",
            match_type: "BROAD",
            quality_score: 3,
            ad_relevance: "BELOW_AVERAGE",
            landing_page_experience: "BELOW_AVERAGE",
            expected_ctr: "AVERAGE",
            impressions: 500,
            clicks: 80,
            cost_micros: 5_000_000_000,
            conversions: 20,
          },
          {
            campaign_id: "1",
            campaign_name: "Search",
            ad_group_id: "10",
            ad_group_name: "Core",
            criterion_id: "2",
            keyword: "rocklin ranch veterinary hospital",
            match_type: "BROAD",
            quality_score: 8,
            ad_relevance: "ABOVE_AVERAGE",
            landing_page_experience: "AVERAGE",
            expected_ctr: "ABOVE_AVERAGE",
            impressions: 400,
            clicks: 60,
            cost_micros: 800_000_000,
            conversions: 25,
          },
        ],
      }),
      supplement: emptySupplement,
    });

    expect(report.executive_snapshot.conversions).toBe(457);
    expect(report.match_type_mix.flag_broad_dominant).toBe(true);
    expect(report.top_keywords.length).toBeGreaterThan(0);
    expect(report.quality_score.summary.quality_score_low).toBe(1);
    expect(report.priorities.some((item) => item.title.includes("Broad Match"))).toBe(true);
  });

  it("flags waste search terms and negative candidates", () => {
    const report = buildAdsAuditReport({
      accountName: "Test Vet",
      sync: baseSync(),
      supplement: {
        ...emptySupplement,
        searchTerms: [
          {
            search_term: "animal control near me",
            campaign_name: "Search",
            ad_group_name: "Core",
            keyword_text: "vet near me",
            impressions: 200,
            clicks: 20,
            cost_micros: 2_000_000_000,
            conversions: 0,
          },
          {
            search_term: "emergency vet near me",
            campaign_name: "Search",
            ad_group_name: "Urgent",
            keyword_text: "emergency vet",
            impressions: 300,
            clicks: 40,
            cost_micros: 1_000_000_000,
            conversions: 10,
          },
        ],
      },
    });

    expect(report.search_terms.waste_terms.length).toBe(1);
    expect(report.search_terms.drift_terms.length).toBe(1);
    expect(report.search_terms.negative_candidates.length).toBeGreaterThan(0);
    expect(report.priorities[0]?.title).toContain("Search term");
  });
});
