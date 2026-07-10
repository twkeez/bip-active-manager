import type { ReportingKpiCard } from "@/lib/types/client";

export const REPORTING_METRIC_REGISTRY = [
  {
    id: "ads-clicks",
    label: "Ads clicks (30d)",
    source: "ads",
    defaultEnabled: true,
    defaultOrder: 10,
  },
  {
    id: "ads-cost-30d",
    label: "Ads Cost (30d)",
    source: "ads",
    defaultEnabled: true,
    defaultOrder: 12,
  },
  {
    id: "ads-cpc-30d",
    label: "Ads Avg CPC (30d)",
    source: "ads",
    defaultEnabled: true,
    defaultOrder: 14,
  },
  {
    id: "ads-conversion-rate-30d",
    label: "Ads Conversion Rate (30d)",
    source: "ads",
    defaultEnabled: true,
    defaultOrder: 16,
  },
  {
    id: "ads-cpa-30d",
    label: "Ads CPA (30d)",
    source: "ads",
    defaultEnabled: false,
    defaultOrder: 18,
  },
  {
    id: "gsc-clicks",
    label: "Search clicks (30d)",
    source: "search_console",
    defaultEnabled: true,
    defaultOrder: 20,
  },
  {
    id: "gsc-avg-position-30d",
    label: "Search Avg Position (30d)",
    source: "search_console",
    defaultEnabled: false,
    defaultOrder: 22,
  },
  {
    id: "gsc-ctr-30d",
    label: "Search CTR (30d)",
    source: "search_console",
    defaultEnabled: false,
    defaultOrder: 24,
  },
  {
    id: "social-reach",
    label: "Social reach (30d)",
    source: "social",
    defaultEnabled: true,
    defaultOrder: 30,
  },
  {
    id: "social-engagement",
    label: "Social engagement (30d)",
    source: "social",
    defaultEnabled: true,
    defaultOrder: 40,
  },
  {
    id: "social-link-clicks-30d",
    label: "Social Link Clicks (30d)",
    source: "social",
    defaultEnabled: false,
    defaultOrder: 42,
  },
  {
    id: "social-follows-30d",
    label: "Social Follows (30d)",
    source: "social",
    defaultEnabled: false,
    defaultOrder: 44,
  },
  {
    id: "seo-open",
    label: "SEO open issues",
    source: "seo",
    defaultEnabled: true,
    defaultOrder: 50,
  },
  {
    id: "seo-critical-issues",
    label: "SEO Critical Issues",
    source: "seo",
    defaultEnabled: false,
    defaultOrder: 52,
  },
  {
    id: "gsc-critical",
    label: "GSC critical signals",
    source: "search_console",
    defaultEnabled: true,
    defaultOrder: 60,
  },
  {
    id: "sitemaps-stale",
    label: "Stale sitemap URLs",
    source: "sitemaps",
    defaultEnabled: true,
    defaultOrder: 70,
  },
  {
    id: "sitemaps-url-count",
    label: "Sitemap URL Count",
    source: "sitemaps",
    defaultEnabled: false,
    defaultOrder: 72,
  },
  {
    id: "ads-ctr",
    label: "Ads CTR (30d)",
    source: "ads",
    defaultEnabled: true,
    defaultOrder: 80,
  },
  {
    id: "ads-search-impression-share",
    label: "Ads Search IS (30d)",
    source: "ads",
    defaultEnabled: true,
    defaultOrder: 85,
  },
  {
    id: "ads-rank-lost-is",
    label: "Ads Lost IS (Rank)",
    source: "ads",
    defaultEnabled: true,
    defaultOrder: 86,
  },
  {
    id: "ads-budget-lost-is",
    label: "Ads Lost IS (Budget)",
    source: "ads",
    defaultEnabled: true,
    defaultOrder: 87,
  },
  {
    id: "ads-auction-competitors",
    label: "Ads Auction Competitors",
    source: "ads",
    defaultEnabled: true,
    defaultOrder: 88,
  },
  {
    id: "ads-auction-overlap-avg",
    label: "Auction Overlap Rate (avg)",
    source: "ads",
    defaultEnabled: false,
    defaultOrder: 89,
  },
  {
    id: "ads-auction-top-impression-share",
    label: "Top Competitor Impr. Share",
    source: "ads",
    defaultEnabled: false,
    defaultOrder: 90,
  },
  {
    id: "gsc-impressions",
    label: "Search impressions (30d)",
    source: "search_console",
    defaultEnabled: true,
    defaultOrder: 92,
  },
  {
    id: "website-total-sessions",
    label: "Website Sessions (30d)",
    source: "ga4",
    defaultEnabled: false,
    defaultOrder: 100,
  },
  {
    id: "website-users",
    label: "Website Users (30d)",
    source: "ga4",
    defaultEnabled: false,
    defaultOrder: 102,
  },
  {
    id: "website-engagement-rate",
    label: "Website Engagement Rate (30d)",
    source: "ga4",
    defaultEnabled: false,
    defaultOrder: 104,
  },
  {
    id: "website-avg-engagement-time",
    label: "Website Avg Engagement Time",
    source: "ga4",
    defaultEnabled: false,
    defaultOrder: 106,
  },
  {
    id: "social-posts-tracked",
    label: "Social Posts Tracked (30d)",
    source: "social",
    defaultEnabled: false,
    defaultOrder: 108,
  },
  {
    id: "social-impressions-30d",
    label: "Social Impressions (30d)",
    source: "social",
    defaultEnabled: false,
    defaultOrder: 110,
  },
  {
    id: "gbp-rating",
    label: "GBP Rating",
    source: "gbp",
    defaultEnabled: true,
    defaultOrder: 120,
  },
  {
    id: "gbp-review-count",
    label: "GBP Review Count",
    source: "gbp",
    defaultEnabled: true,
    defaultOrder: 122,
  },
  {
    id: "gbp-reviews-30d",
    label: "GBP New Reviews (30d)",
    source: "gbp",
    defaultEnabled: true,
    defaultOrder: 124,
  },
  {
    id: "gbp-review-sentiment-30d",
    label: "GBP Review Sentiment (30d)",
    source: "gbp",
    defaultEnabled: false,
    defaultOrder: 126,
  },
  {
    id: "meta-ads-spend-30d",
    label: "Meta Ads Spend (30d)",
    source: "meta_ads",
    defaultEnabled: true,
    defaultOrder: 20,
  },
  {
    id: "meta-ads-reach-30d",
    label: "Meta Ads Reach (30d)",
    source: "meta_ads",
    defaultEnabled: true,
    defaultOrder: 22,
  },
  {
    id: "meta-ads-results-30d",
    label: "Meta Ads Results (30d)",
    source: "meta_ads",
    defaultEnabled: true,
    defaultOrder: 24,
  },
] as const;

export type ReportingMetricId = (typeof REPORTING_METRIC_REGISTRY)[number]["id"];

export type ReportingMetricPreferenceInput = {
  metric_id: string;
  is_enabled: boolean;
  display_order: number;
};

export type ReportingMetricControl = {
  metricId: ReportingMetricId;
  label: string;
  source: ReportingKpiCard["source"];
  isEnabled: boolean;
  displayOrder: number;
};

const METRIC_IDS = new Set<string>(REPORTING_METRIC_REGISTRY.map((metric) => metric.id));
const METRIC_REGISTRY_BY_ID = new Map(
  REPORTING_METRIC_REGISTRY.map((metric) => [metric.id, metric]),
);

export function isValidReportingMetricId(value: unknown): value is ReportingMetricId {
  return typeof value === "string" && METRIC_IDS.has(value);
}

function toMetricPreferenceMap(preferences: ReportingMetricPreferenceInput[]) {
  const map = new Map<ReportingMetricId, ReportingMetricPreferenceInput>();
  for (const row of preferences) {
    if (!isValidReportingMetricId(row.metric_id)) continue;
    map.set(row.metric_id, row);
  }
  return map;
}

export function buildReportingMetricControls(
  preferences: ReportingMetricPreferenceInput[],
): ReportingMetricControl[] {
  const prefMap = toMetricPreferenceMap(preferences);
  return REPORTING_METRIC_REGISTRY.map((metric) => {
    const saved = prefMap.get(metric.id);
    return {
      metricId: metric.id,
      label: metric.label,
      source: metric.source,
      isEnabled: saved?.is_enabled ?? metric.defaultEnabled,
      displayOrder: saved?.display_order ?? metric.defaultOrder,
    };
  }).sort((left, right) => left.displayOrder - right.displayOrder);
}

export function applyReportingMetricPreferences(
  metrics: ReportingKpiCard[],
  preferences: ReportingMetricPreferenceInput[],
): ReportingKpiCard[] {
  const prefMap = toMetricPreferenceMap(preferences);
  return metrics
    .map((metric, index) => {
      const meta = METRIC_REGISTRY_BY_ID.get(metric.id as ReportingMetricId);
      if (!meta) return null;
      const saved = prefMap.get(meta.id);
      const isEnabled = saved?.is_enabled ?? meta.defaultEnabled;
      const displayOrder = saved?.display_order ?? meta.defaultOrder;
      if (!isEnabled) return null;
      return { metric, displayOrder, index };
    })
    .filter(
      (row): row is { metric: ReportingKpiCard; displayOrder: number; index: number } =>
        Boolean(row),
    )
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder || left.index - right.index,
    )
    .map((row) => row.metric);
}
