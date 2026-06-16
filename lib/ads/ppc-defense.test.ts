import { describe, expect, it } from "vitest";
import { buildBudgetHogs, buildLpDeficits, summarizePpcDefense } from "@/lib/ads/ppc-defense";
import type { AdsSnapshot } from "@/lib/types/client";

function snapshot(
  overrides: Partial<AdsSnapshot> & Pick<AdsSnapshot, "client_id">,
): AdsSnapshot {
  return {
    id: 1,
    client_id: overrides.client_id,
    customer_id: "1234567890",
    start_date: "2026-04-01",
    end_date: "2026-04-30",
    run_status: "completed",
    error_message: null,
    totals: {
      impressions: 1000,
      clicks: 100,
      cost_micros: 321_290_000,
      conversions: 5,
      ctr: 0.1,
      average_cpc: 3_212_900,
    },
    campaigns: [],
    keyword_quality: [],
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildLpDeficits", () => {
  it("flags keywords with below-average landing page experience", () => {
    const clients = [{ id: 874, account_name: "All Critters", ads_customer_id: "1234567890" }];
    const deficits = buildLpDeficits({
      clients,
      snapshots: [
        snapshot({
          client_id: 874,
          keyword_quality: [
            {
              campaign_id: "1",
              campaign_name: "Exotics-Search",
              ad_group_id: "10",
              ad_group_name: "Core",
              criterion_id: "100",
              keyword: "dog medicine",
              match_type: "PHRASE",
              quality_score: 4,
              ad_relevance: "AVERAGE",
              landing_page_experience: "BELOW_AVERAGE",
              expected_ctr: "AVERAGE",
              impressions: 200,
              clicks: 40,
              cost_micros: 150_780_000,
              conversions: 0,
            },
          ],
        }),
      ],
    });

    expect(deficits).toHaveLength(1);
    expect(deficits[0]?.keyword).toBe("dog medicine");
    expect(deficits[0]?.status).toBe("LP Below Average");
  });
});

describe("buildBudgetHogs", () => {
  it("flags keywords over 30% spend with fewer than 2 conversions", () => {
    const clients = [{ id: 874, account_name: "All Critters", ads_customer_id: "1234567890" }];
    const hogs = buildBudgetHogs({
      clients,
      snapshots: [
        snapshot({
          client_id: 874,
          totals: {
            impressions: 1000,
            clicks: 100,
            cost_micros: 321_290_000,
            conversions: 2,
            ctr: 0.1,
            average_cpc: 3_212_900,
          },
          keyword_quality: [
            {
              campaign_id: "1",
              campaign_name: "Exotics-Search",
              ad_group_id: "10",
              ad_group_name: "Core",
              criterion_id: "100",
              keyword: "dog medicine",
              match_type: "PHRASE",
              quality_score: 4,
              ad_relevance: "AVERAGE",
              landing_page_experience: "AVERAGE",
              expected_ctr: "AVERAGE",
              impressions: 200,
              clicks: 40,
              cost_micros: 150_780_000,
              conversions: 0,
            },
          ],
        }),
      ],
    });

    expect(hogs).toHaveLength(1);
    expect(hogs[0]?.pctOfBudget).toBeGreaterThan(30);
    expect(hogs[0]?.conversions).toBe(0);
    expect(hogs[0]?.keywordSpendLabel).toBe("$150.78");
    expect(hogs[0]?.totalSpendLabel).toBe("$321.29");
  });

  it("ignores keywords below spend threshold or with 2+ conversions", () => {
    const clients = [{ id: 1, account_name: "A", ads_customer_id: "1234567890" }];
    const hogs = buildBudgetHogs({
      clients,
      snapshots: [
        snapshot({
          client_id: 1,
          totals: {
            impressions: 1000,
            clicks: 100,
            cost_micros: 1_000_000_000,
            conversions: 10,
            ctr: 0.1,
            average_cpc: 10_000_000,
          },
          keyword_quality: [
            {
              campaign_id: "1",
              campaign_name: "Search",
              ad_group_id: "10",
              ad_group_name: "Core",
              criterion_id: "100",
              keyword: "efficient kw",
              match_type: "PHRASE",
              quality_score: 8,
              ad_relevance: "AVERAGE",
              landing_page_experience: "AVERAGE",
              expected_ctr: "AVERAGE",
              impressions: 200,
              clicks: 40,
              cost_micros: 100_000_000,
              conversions: 5,
            },
          ],
        }),
      ],
    });

    expect(hogs).toHaveLength(0);
  });
});

describe("summarizePpcDefense", () => {
  it("counts deficits and hogs", () => {
    const summary = summarizePpcDefense({
      lpDeficits: [{ clientId: 1 } as never, { clientId: 2 } as never],
      budgetHogs: [{ clientId: 1 } as never],
      accountsScanned: 5,
      keywordsScanned: 100,
    });
    expect(summary.lpDeficitCount).toBe(2);
    expect(summary.budgetHogCount).toBe(1);
    expect(summary.lpAccountsAffected).toBe(2);
    expect(summary.hogAccountsAffected).toBe(1);
  });
});
