import { describe, expect, it } from "vitest";
import { computeAdsTotals, describePartErrors, type AdsCampaignRow } from "@/lib/ads/google-ads";

function campaign(overrides: Partial<AdsCampaignRow>): AdsCampaignRow {
  return {
    campaign_id: "1",
    campaign_name: "Campaign",
    impressions: 0,
    clicks: 0,
    interactions: 0,
    cost_micros: 0,
    conversions: 0,
    all_conversions: 0,
    view_through_conversions: 0,
    conversions_value: 0,
    phone_calls: 0,
    phone_impressions: 0,
    ctr: 0,
    search_impression_share: null,
    search_rank_lost_impression_share: null,
    search_budget_lost_impression_share: null,
    search_top_impression_share: null,
    search_absolute_top_impression_share: null,
    ...overrides,
  };
}

describe("computeAdsTotals", () => {
  it("adds up every campaign, however many there are", () => {
    // 60 campaigns: the old query stopped at 50 and undercounted the account.
    const campaigns = Array.from({ length: 60 }, (_, i) =>
      campaign({ campaign_id: String(i), impressions: 100, clicks: 10, cost_micros: 5_000_000, conversions: 1 }),
    );
    const totals = computeAdsTotals(campaigns);
    expect(totals.impressions).toBe(6000);
    expect(totals.clicks).toBe(600);
    expect(totals.cost_micros).toBe(300_000_000);
    expect(totals.conversions).toBe(60);
    expect(totals.ctr).toBeCloseTo(0.1);
    expect(totals.average_cpc).toBe(500_000);
    expect(totals.cost_per_conversion).toBe(5);
  });

  it("averages impression share only over campaigns that report one", () => {
    const totals = computeAdsTotals([
      campaign({ impressions: 1000, search_impression_share: 0.6 }),
      campaign({ impressions: 3000, search_impression_share: 0.2 }),
      // A Display campaign has no search impression share; it must not drag the figure to 0.
      campaign({ impressions: 50_000, search_impression_share: null }),
    ]);
    expect(totals.search_impression_share).toBeCloseTo((0.6 * 1000 + 0.2 * 3000) / 4000);
  });

  it("gives no impression share when no campaign reports one", () => {
    expect(computeAdsTotals([campaign({ impressions: 10 })]).search_impression_share).toBeNull();
  });

  it("leaves rates empty rather than dividing by zero", () => {
    const totals = computeAdsTotals([]);
    expect(totals.ctr).toBe(0);
    expect(totals.conversion_rate).toBeNull();
    expect(totals.cost_per_conversion).toBeNull();
    expect(totals.roas).toBeNull();
  });
});

describe("describePartErrors", () => {
  it("is empty when every part was read", () => {
    expect(describePartErrors([])).toBeNull();
  });

  it("names each part that could not be read", () => {
    expect(
      describePartErrors([
        { part: "calls", message: "call reporting is off" },
        { part: "auction_insights", message: "timeout" },
      ]),
    ).toBe("Partial sync. Call details could not be read (call reporting is off). Auction insights could not be read (timeout).");
  });
});
