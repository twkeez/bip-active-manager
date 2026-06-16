import { describe, expect, it } from "vitest";
import { buildGlobalAdsIssues, summarizeGlobalAdsIssues } from "@/lib/ads/global-optimization";
import type { AdsKeywordQualityRow, AdsSnapshot } from "@/lib/types/client";

function keywordRow(
  overrides: Partial<AdsKeywordQualityRow> & Pick<AdsKeywordQualityRow, "keyword">,
): AdsKeywordQualityRow {
  return {
    campaign_id: "1",
    campaign_name: "Search-1 Campaign",
    ad_group_id: "10",
    ad_group_name: "Core",
    criterion_id: "100",
    match_type: "PHRASE",
    quality_score: 8,
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

function snapshot(overrides: Partial<AdsSnapshot> & Pick<AdsSnapshot, "client_id">): AdsSnapshot {
  return {
    id: 1,
    client_id: overrides.client_id,
    customer_id: "123",
    start_date: "2026-04-01",
    end_date: "2026-04-30",
    run_status: "completed",
    error_message: null,
    totals: {
      impressions: 1000,
      clicks: 100,
      cost_micros: 1_000_000,
      conversions: 5,
      ctr: 0.1,
      average_cpc: 10_000,
      search_budget_lost_impression_share: null,
      search_rank_lost_impression_share: null,
    },
    campaigns: [],
    keyword_quality: [],
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildGlobalAdsIssues", () => {
  const clients = [
    { id: 874, account_name: "All Critters Veterinary Hospital", ads_customer_id: "1111111111" },
    { id: 102, account_name: "Metro Pet Emergency", ads_customer_id: "2222222222" },
  ];

  it("flags ad relevance, budget, quality score, and expected CTR issues", () => {
    const issues = buildGlobalAdsIssues({
      clients,
      snapshots: [
        snapshot({
          client_id: 874,
          keyword_quality: [
            keywordRow({ keyword: "dog medicine", ad_relevance: "BELOW_AVERAGE" }),
          ],
          campaigns: [
            {
              campaign_id: "c1",
              campaign_name: "Search-1 Campaign",
              impressions: 500,
              clicks: 50,
              cost_micros: 800_000,
              conversions: 2,
              ctr: 0.1,
              search_budget_lost_impression_share: 0.3,
              search_rank_lost_impression_share: null,
            },
          ],
        }),
        snapshot({
          client_id: 102,
          keyword_quality: [
            keywordRow({ keyword: "cat emergency clinic", quality_score: 2 }),
            keywordRow({
              keyword: "pet vaccinations",
              expected_ctr: "BELOW_AVERAGE",
              criterion_id: "101",
            }),
          ],
        }),
      ],
    });

    expect(issues.some((issue) => issue.issueLabel === "Ad Relevance" && issue.target === "dog medicine")).toBe(
      true,
    );
    expect(
      issues.some(
        (issue) => issue.issueLabel === "Budget Capped" && issue.target === "Search-1 Campaign",
      ),
    ).toBe(true);
    expect(
      issues.some((issue) => issue.issueLabel === "Low Quality Score" && issue.severity === "critical"),
    ).toBe(true);
    expect(issues.some((issue) => issue.issueLabel === "Expected CTR")).toBe(true);
  });

  it("skips impression share leakage at or below 15%", () => {
    const issues = buildGlobalAdsIssues({
      clients,
      snapshots: [
        snapshot({
          client_id: 874,
          totals: {
            impressions: 1000,
            clicks: 100,
            cost_micros: 1_000_000,
            conversions: 5,
            ctr: 0.1,
            average_cpc: 10_000,
            search_budget_lost_impression_share: 0.15,
            search_rank_lost_impression_share: null,
          },
        }),
      ],
    });

    expect(issues.filter((issue) => issue.issueType === "budget_capped")).toHaveLength(0);
  });
});

describe("summarizeGlobalAdsIssues", () => {
  it("counts unique affected accounts by category", () => {
    const issues = buildGlobalAdsIssues({
      clients: [{ id: 1, account_name: "A", ads_customer_id: "1234567890" }],
      snapshots: [
        snapshot({
          client_id: 1,
          keyword_quality: [keywordRow({ keyword: "test", ad_relevance: "BELOW_AVERAGE" })],
          campaigns: [
            {
              campaign_id: "c1",
              campaign_name: "Search",
              impressions: 100,
              clicks: 10,
              cost_micros: 100_000,
              conversions: 1,
              ctr: 0.1,
              search_budget_lost_impression_share: 0.2,
              search_rank_lost_impression_share: null,
            },
          ],
        }),
      ],
    });

    const summary = summarizeGlobalAdsIssues(issues);
    expect(summary.budgetCappedAccountCount).toBe(1);
    expect(summary.relevanceCtrAccountCount).toBe(1);
    expect(summary.totalIssues).toBeGreaterThan(0);
  });
});
