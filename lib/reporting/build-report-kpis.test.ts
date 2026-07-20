import { describe, expect, it } from "vitest";
import { buildReportingKpis } from "@/lib/reporting/build-report";
import { buildSocialByPlatform } from "@/lib/reporting/social-metrics";
import type {
  AdsSnapshot,
  Ga4Snapshot,
  GbpReviewRow,
  GbpSnapshot,
  GscPageMetric,
  GscSignal,
  MetaAdsSnapshot,
  ReportingKpiCard,
  SitemapSnapshot,
  SocialDailySnapshot,
} from "@/lib/types/client";

// ---------------------------------------------------------------------------
// Verification suite for the calculated reporting KPIs.
//
// This locks down the derived (not pass-through) metrics in buildReportingKpis
// with hand-checked expected values. Every assertion below is a number a human
// can re-derive from the fixture; if the math in build-report.ts drifts, the
// exact failing metric is named. Pass-through fields (raw snapshot values we
// only format) are covered too so the formatting can't silently regress.
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const daysAgoIso = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const daysAgoDate = (days: number) => daysAgoIso(days).slice(0, 10);
const nowSec = () => Math.floor(Date.now() / 1000);

function kpi(cards: ReportingKpiCard[], id: string): string | undefined {
  return cards.find((card) => card.id === id)?.value;
}

// --- Ads: 500 clicks, $250.00 spend, 25 conversions, 8 phone calls -----------
const adsSnapshot: AdsSnapshot = {
  id: 1,
  client_id: 1,
  customer_id: "123-456-7890",
  start_date: daysAgoDate(30),
  end_date: daysAgoDate(0),
  run_status: "completed",
  error_message: null,
  totals: {
    impressions: 10_000,
    clicks: 500,
    interactions: 500,
    cost_micros: 250_000_000, // $250.00
    conversions: 25,
    phone_calls: 8,
    ctr: 0.05, // 500 / 10000
    average_cpc: 500_000, // 250_000_000 / 500 micros -> $0.50
    conversion_rate: 0.05, // 25 / 500 (sync-derived, same formula the card uses)
    cost_per_conversion: 10, // 250 / 25 dollars
    search_impression_share: 0.65,
    search_rank_lost_impression_share: 0.2,
    search_budget_lost_impression_share: 0.15,
  },
  campaigns: [],
  auction_insights: [
    { campaign_id: "c1", campaign_name: "C1", domain: "rival-a.com", impression_share: 0.3, overlap_rate: 0.4, position_above_rate: null, top_of_page_rate: null, outranking_share: null },
    { campaign_id: "c1", campaign_name: "C1", domain: "rival-b.com", impression_share: 0.5, overlap_rate: 0.6, position_above_rate: null, top_of_page_rate: null, outranking_share: null },
    { campaign_id: "c1", campaign_name: "C1", domain: "rival-a.com", impression_share: 0.1, overlap_rate: 0.2, position_above_rate: null, top_of_page_rate: null, outranking_share: null },
  ],
  created_at: daysAgoIso(1),
  updated_at: daysAgoIso(1),
};

// --- Meta ads: results = leads + messages + link clicks = 5 + 3 + 20 = 28 ----
const metaAdsSnapshot: MetaAdsSnapshot = {
  id: 1,
  client_id: 1,
  ad_account_id: "act_1",
  ad_account_name: "Acct",
  start_date: daysAgoDate(30),
  end_date: daysAgoDate(0),
  run_status: "completed",
  error_message: null,
  totals: {
    spend: 123.45,
    impressions: 20_000,
    reach: 9_876,
    frequency: 2,
    clicks: 300,
    ctr: 1.5,
    cpc: 0.41,
    cpm: 6.17,
    link_clicks: 20,
    leads: 5,
    messaging_conversations_started: 3,
    purchases: null,
    cost_per_link_click: null,
    cost_per_lead: null,
    cost_per_messaging_conversation: null,
    cost_per_purchase: null,
    purchase_roas: null,
  },
  campaigns: [],
  created_at: daysAgoIso(1),
  updated_at: daysAgoIso(1),
};

// --- GSC pages: clicks 150, impressions 5000, ctr 3.00% ----------------------
const gscPageMetrics: GscPageMetric[] = [
  { id: 1, client_id: 1, snapshot_id: 1, page_url: "https://x.com/a", clicks: 100, impressions: 1_000, ctr: 0.1, position: 4, created_at: daysAgoIso(1) },
  { id: 2, client_id: 1, snapshot_id: 1, page_url: "https://x.com/b", clicks: 50, impressions: 4_000, ctr: 0.0125, position: 9, created_at: daysAgoIso(1) },
];

function gscSignal(id: number, severity: "critical" | "watch"): GscSignal {
  return {
    id, client_id: 1, snapshot_id: 1, signal_id: `sig-${id}`, severity,
    title: `Signal ${id}`, description: null, suggestion: null, page_url: null,
    query: null, metric_value: null, occurrence_key: `k-${id}`, created_at: daysAgoIso(1),
  };
}
const gscSignals: GscSignal[] = [gscSignal(1, "critical"), gscSignal(2, "critical"), gscSignal(3, "watch")];

// --- Social daily rows (IG + FB, within 30d) ---------------------------------
function social(
  platform: "facebook" | "instagram",
  days: number,
  vals: Partial<Pick<SocialDailySnapshot, "reach" | "impressions" | "engagement" | "link_clicks" | "follows">>,
): SocialDailySnapshot {
  return {
    id: Math.round(Math.random() * 1e9), client_id: 1, connection_id: 1, platform,
    snapshot_date: daysAgoDate(days), reach: null, impressions: null, engagement: null,
    profile_visits: null, follows: null, link_clicks: null, created_at: daysAgoIso(days),
    ...vals,
  };
}
const socialDailyRows: SocialDailySnapshot[] = [
  social("instagram", 5, { reach: 100, impressions: 200, engagement: 10, link_clicks: 3, follows: 5 }),
  social("instagram", 2, { reach: 120, impressions: 250, engagement: 20, link_clicks: 4, follows: 7 }),
  social("facebook", 5, { reach: 500, impressions: 300, engagement: 30, link_clicks: 5, follows: 1_000 }),
  social("facebook", 2, { reach: 600, impressions: 350, engagement: 40, link_clicks: 6, follows: 1_010 }),
];
const socialPeriodReach = [{ platform: "instagram", reach: 220 }];

// --- GBP ---------------------------------------------------------------------
const gbpSnapshot: GbpSnapshot = {
  id: 1, client_id: 1, place_id: "p1", place_name: "Clinic", profile_url: null, website_url: null,
  address: null, rating: 4.6, user_ratings_total: 120, last_post_at: null, profile_fields: null,
  run_status: "completed", error_message: null, created_at: daysAgoIso(1), updated_at: daysAgoIso(1),
};
function review(id: number, daysAgo: number, rating: number | null): GbpReviewRow {
  return {
    id, client_id: 1, snapshot_id: 1, author_name: null, rating, text: null,
    relative_time_description: null, review_time_unix: nowSec() - daysAgo * 86_400, created_at: daysAgoIso(daysAgo),
  };
}
const gbpReviews: GbpReviewRow[] = [review(1, 5, 5), review(2, 10, 3), review(3, 40, 1)];

// --- Sitemap -----------------------------------------------------------------
const sitemapSnapshot: SitemapSnapshot = {
  id: 1, client_id: 1, sitemap_url: "https://x.com/sitemap.xml", fetched_at: daysAgoIso(1),
  run_status: "completed", error_message: null, url_count: 200, with_lastmod_count: 180,
  latest_lastmod: null, stale_90_count: 12, created_at: daysAgoIso(1), updated_at: daysAgoIso(1),
};

// --- GA4 ---------------------------------------------------------------------
const ga4Snapshot: Ga4Snapshot = {
  id: 1, client_id: 1, property_id: "props/1", start_date: daysAgoDate(30), end_date: daysAgoDate(0),
  run_status: "completed", error_message: null,
  totals: { sessions: 3_456, users: 2_100, new_users: 900, engagement_rate: 0.72, avg_engagement_time_seconds: 83, conversions: 40 },
  previous_totals: null, channel_breakdown: [], top_pages: [], created_at: daysAgoIso(1), updated_at: daysAgoIso(1),
} as unknown as Ga4Snapshot;

function build() {
  return buildReportingKpis({
    adsSnapshot,
    metaAdsSnapshot,
    ga4Snapshot,
    gscPageMetrics,
    gscSignals,
    gscSnapshotUpdatedAt: daysAgoIso(1),
    socialDailyRows,
    socialPeriodReach,
    socialPostCount: 6,
    socialConnected: true,
    crawlIssueCount: 3,
    technicalFindingCount: 4,
    technicalCriticalCount: 2,
    sitemapSnapshot,
    gbpSnapshot,
    gbpReviews,
    lighthouseFetchedAt: daysAgoIso(1),
    crawlUpdatedAt: daysAgoIso(1),
  });
}

describe("buildReportingKpis — calculated metrics", () => {
  const cards = build();

  it("Ads: pass-through totals are formatted correctly", () => {
    expect(kpi(cards, "ads-clicks")).toBe("500");
    expect(kpi(cards, "ads-cost-30d")).toBe("$250.00");
    expect(kpi(cards, "ads-cpc-30d")).toBe("$0.50");
    expect(kpi(cards, "ads-calls-30d")).toBe("8");
    expect(kpi(cards, "ads-ctr")).toBe("5.00%");
    expect(kpi(cards, "ads-search-impression-share")).toBe("65.00%");
    expect(kpi(cards, "ads-rank-lost-is")).toBe("20.00%");
    expect(kpi(cards, "ads-budget-lost-is")).toBe("15.00%");
  });

  it("Ads: conversion rate = conversions / clicks (25 / 500 = 5.00%)", () => {
    expect(kpi(cards, "ads-conversion-rate-30d")).toBe("5.00%");
  });

  it("Ads: CPA = spend / conversions ($250 / 25 = $10.00)", () => {
    expect(kpi(cards, "ads-cpa-30d")).toBe("$10.00");
  });

  it("Ads: auction insights — unique domains, avg overlap, top impression share", () => {
    expect(kpi(cards, "ads-auction-competitors")).toBe("2"); // rival-a, rival-b
    expect(kpi(cards, "ads-auction-overlap-avg")).toBe("40.00%"); // (0.4+0.6+0.2)/3
    expect(kpi(cards, "ads-auction-top-impression-share")).toBe("50.00%"); // max(0.3,0.5,0.1)
  });

  it("Meta ads: results = leads + messages + link clicks (5 + 3 + 20 = 28)", () => {
    expect(kpi(cards, "meta-ads-spend-30d")).toBe("$123.45");
    expect(kpi(cards, "meta-ads-reach-30d")).toBe("9,876");
    expect(kpi(cards, "meta-ads-results-30d")).toBe("28");
  });

  it("Search Console: clicks/impressions summed, CTR = clicks / impressions", () => {
    expect(kpi(cards, "gsc-clicks")).toBe("150");
    expect(kpi(cards, "gsc-impressions")).toBe("5,000");
    expect(kpi(cards, "gsc-ctr-30d")).toBe("3.00%"); // 150 / 5000
    expect(kpi(cards, "gsc-critical")).toBe("2"); // 2 critical signals
  });

  it("Social: reach is de-duplicated (IG period reach only; FB excluded)", () => {
    // FB daily reach (500, 600) is NOT summed in; only IG's period reach (220).
    expect(kpi(cards, "social-reach")).toBe("220");
  });

  it("Social: engagement / link clicks / impressions summed across platforms", () => {
    expect(kpi(cards, "social-engagement")).toBe("100"); // 10+20+30+40
    expect(kpi(cards, "social-link-clicks-30d")).toBe("18"); // 3+4+5+6
    expect(kpi(cards, "social-impressions-30d")).toBe("1,100"); // 200+250+300+350
    expect(kpi(cards, "social-posts-tracked")).toBe("6");
  });

  it("Social: follows are net-new (IG summed 12 + FB last−first 10 = 22)", () => {
    expect(kpi(cards, "social-follows-30d")).toBe("22");
  });

  it("SEO: open issues = crawl + technical; critical = technical critical", () => {
    expect(kpi(cards, "seo-open")).toBe("7"); // 3 + 4
    expect(kpi(cards, "seo-critical-issues")).toBe("2");
  });

  it("GBP: rating, review count, 30-day new reviews, 30-day sentiment", () => {
    expect(kpi(cards, "gbp-rating")).toBe("4.60 / 5");
    expect(kpi(cards, "gbp-review-count")).toBe("120");
    expect(kpi(cards, "gbp-reviews-30d")).toBe("2"); // 40-day-old review excluded
    expect(kpi(cards, "gbp-review-sentiment-30d")).toBe("4.00 / 5"); // (5 + 3) / 2
  });

  it("Sitemaps: stale + total URL counts pass through", () => {
    expect(kpi(cards, "sitemaps-stale")).toBe("12");
    expect(kpi(cards, "sitemaps-url-count")).toBe("200");
  });

  it("GA4: sessions pass through and format with separators", () => {
    expect(kpi(cards, "website-total-sessions")).toBe("3,456");
    expect(kpi(cards, "website-engagement-rate")).toBe("72.0%");
  });

  it("aggregate Search Console Avg Position is no longer a KPI", () => {
    expect(cards.find((card) => card.id === "gsc-avg-position-30d")).toBeUndefined();
  });

  it("conversion rate reads the stored (sync-derived) field, not a re-computation", () => {
    // Distinct stored value (0.2) that does NOT equal conversions/clicks (0.05):
    // proves the card now trusts the snapshot field rather than recomputing.
    const withStored = buildReportingKpis({
      adsSnapshot: { ...adsSnapshot, totals: { ...adsSnapshot.totals, conversion_rate: 0.2, cost_per_conversion: 42 } },
      metaAdsSnapshot, ga4Snapshot, gscPageMetrics, gscSignals,
      gscSnapshotUpdatedAt: daysAgoIso(1), socialDailyRows, socialPeriodReach,
      socialPostCount: 6, socialConnected: true, crawlIssueCount: 3,
      technicalFindingCount: 4, technicalCriticalCount: 2, sitemapSnapshot,
      gbpSnapshot, gbpReviews, lighthouseFetchedAt: daysAgoIso(1), crawlUpdatedAt: daysAgoIso(1),
    });
    expect(kpi(withStored, "ads-conversion-rate-30d")).toBe("20.00%");
    expect(kpi(withStored, "ads-cpa-30d")).toBe("$42.00");
  });
});

describe("buildSocialByPlatform", () => {
  it("computes reach, follows, engagement per platform correctly", () => {
    const byPlatform = buildSocialByPlatform(socialDailyRows, socialPeriodReach, 30);
    const ig = byPlatform.find((p) => p.platform === "instagram");
    const fb = byPlatform.find((p) => p.platform === "facebook");

    // Instagram: reach from stored period reach; follows summed daily.
    expect(ig?.reach).toBe(220);
    expect(ig?.newFollowers).toBe(12); // 5 + 7
    expect(ig?.engagement).toBe(30); // 10 + 20

    // Facebook: reach unavailable (null); follows are cumulative -> last − first.
    expect(fb?.reach).toBeNull();
    expect(fb?.newFollowers).toBe(10); // 1010 − 1000
    expect(fb?.engagement).toBe(70); // 30 + 40
  });
});
