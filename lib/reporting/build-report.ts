import { websiteLabel } from "@/lib/reporting/format";
import type {
  AdsSnapshot,
  Ga4Snapshot,
  GbpReviewRow,
  GbpSnapshot,
  KeywordHealthRow,
  ReportingAlertItem,
  ReportingFreshnessItem,
  ReportingKpiCard,
  SocialDailySnapshot,
  SocialPostSnapshot,
  StrategistSummaryResult,
  GscPageMetric,
  GscSignal,
  SitemapSnapshot,
  ClientRow,
} from "@/lib/types/client";
import type {
  ClientReportModel,
  DetailedBreakdownChartData,
  ManagedKeyword,
  ReportChannelBlock,
  ReportKeywordRow,
  ReportKeywordSection,
  ReportKeywordTrendPoint,
  ReportPeriodMetric,
  ReportingActionItem,
  ReportRecommendationItem,
  WeeklyPerfRow,
} from "@/lib/reporting/types";
import { REPORTING_METRIC_REGISTRY } from "@/lib/reporting/metric-registry";

function formatChangePercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatChangeAbsolute(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value).toLocaleString()}`;
}

function aggregateSocialWindow(
  rows: SocialDailySnapshot[],
  startInclusive: number,
  endExclusive: number,
) {
  return rows
    .filter((row) => {
      const ts = new Date(row.snapshot_date).getTime();
      return Number.isFinite(ts) && ts >= startInclusive && ts < endExclusive;
    })
    .reduce(
      (acc, row) => {
        acc.reach += row.reach ?? 0;
        acc.engagement += row.engagement ?? 0;
        acc.impressions += row.impressions ?? 0;
        return acc;
      },
      { reach: 0, engagement: 0, impressions: 0 },
    );
}

export function buildWeeklyPerformanceRows(params: {
  socialDailyRows: SocialDailySnapshot[];
  keywordRows: KeywordHealthRow[];
  adsSnapshot: AdsSnapshot | null;
}): WeeklyPerfRow[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = now - 7 * dayMs;
  const previousStart = now - 14 * dayMs;

  const socialCurrent = aggregateSocialWindow(params.socialDailyRows, currentStart, now + dayMs);
  const socialPrevious = aggregateSocialWindow(params.socialDailyRows, previousStart, currentStart);
  const socialRows: WeeklyPerfRow[] = [
    {
      label: "Social Reach",
      category: "channel",
      current: socialCurrent.reach,
      previous: socialPrevious.reach,
      deltaAbsolute: socialCurrent.reach - socialPrevious.reach,
      deltaPercent:
        socialPrevious.reach > 0
          ? ((socialCurrent.reach - socialPrevious.reach) / socialPrevious.reach) * 100
          : null,
    },
    {
      label: "Social Engagement",
      category: "channel",
      current: socialCurrent.engagement,
      previous: socialPrevious.engagement,
      deltaAbsolute: socialCurrent.engagement - socialPrevious.engagement,
      deltaPercent:
        socialPrevious.engagement > 0
          ? ((socialCurrent.engagement - socialPrevious.engagement) / socialPrevious.engagement) *
            100
          : null,
    },
    {
      label: "Social Impressions",
      category: "channel",
      current: socialCurrent.impressions,
      previous: socialPrevious.impressions,
      deltaAbsolute: socialCurrent.impressions - socialPrevious.impressions,
      deltaPercent:
        socialPrevious.impressions > 0
          ? ((socialCurrent.impressions - socialPrevious.impressions) / socialPrevious.impressions) *
            100
          : null,
    },
  ];

  const keywordPrevious = params.keywordRows.reduce((sum, row) => sum + row.previous_clicks, 0);
  const keywordCurrent = params.keywordRows.reduce((sum, row) => sum + row.current_clicks, 0);
  const searchRow: WeeklyPerfRow = {
    label: "Search Clicks (Top Tracked Keywords)",
    category: "channel",
    current: keywordCurrent,
    previous: keywordPrevious,
    deltaAbsolute: keywordCurrent - keywordPrevious,
    deltaPercent:
      keywordPrevious > 0 ? ((keywordCurrent - keywordPrevious) / keywordPrevious) * 100 : null,
  };

  const campaignRows: WeeklyPerfRow[] =
    params.adsSnapshot?.campaigns.slice(0, 4).map((campaign) => ({
      label: `Campaign: ${campaign.campaign_name}`,
      category: "campaign",
      current: campaign.conversions,
      previous: null,
      deltaAbsolute: null,
      deltaPercent: null,
    })) ?? [];

  return [...socialRows, searchRow, ...campaignRows];
}

export function buildDetailedBreakdownChartData(params: {
  socialDailyRows: SocialDailySnapshot[];
  perfRows: WeeklyPerfRow[];
}): DetailedBreakdownChartData {
  const trendData = params.socialDailyRows
    .slice(0, 14)
    .reverse()
    .map((row) => ({
      date: row.snapshot_date.slice(5),
      engagement: row.engagement ?? 0,
      reach: row.reach ?? 0,
    }));

  const channelData = params.perfRows
    .filter((row) => row.category === "channel")
    .map((row) => ({
      name: row.label.replace("Social ", "").replace(" (Top Tracked Keywords)", ""),
      value: Math.round(row.current),
    }));

  const positive = params.perfRows
    .filter((row) => (row.deltaAbsolute ?? 0) > 0)
    .reduce((sum, row) => sum + (row.deltaAbsolute ?? 0), 0);

  const negative = params.perfRows
    .filter((row) => (row.deltaAbsolute ?? 0) < 0)
    .reduce((sum, row) => sum + Math.abs(row.deltaAbsolute ?? 0), 0);

  const waterfallData = [
    { name: "Gains" as const, value: Math.round(positive), fill: "#22c55e" },
    { name: "Dips" as const, value: -Math.round(negative), fill: "#ef4444" },
  ];

  return { trendData, channelData, waterfallData };
}

export function buildReportRecommendations(params: {
  perfRows: WeeklyPerfRow[];
  adsSnapshot: AdsSnapshot | null;
  criticalAlerts: ReportingAlertItem[];
  strategistSummary: StrategistSummaryResult | null;
}): ReportRecommendationItem[] {
  const rowsWithTrend = params.perfRows.filter(
    (row) => row.deltaPercent != null && row.deltaAbsolute != null,
  );
  const sortedByTrend = [...rowsWithTrend].sort(
    (a, b) => (b.deltaPercent ?? -Infinity) - (a.deltaPercent ?? -Infinity),
  );
  const gains = sortedByTrend.filter((row) => (row.deltaPercent ?? 0) > 0).slice(0, 3);
  const dips = [...sortedByTrend].reverse().filter((row) => (row.deltaPercent ?? 0) < 0).slice(0, 3);

  const recs: ReportRecommendationItem[] = [];
  if (dips.length > 0) {
    const topDip = dips[0]!;
    recs.push({
      priority: "high",
      text: `Pause or reallocate budget from ${topDip.label} (down ${formatChangePercent(
        topDip.deltaPercent,
      )}, ${formatChangeAbsolute(topDip.deltaAbsolute)}).`,
    });
  }
  if (gains.length > 0) {
    const topGain = gains[0]!;
    recs.push({
      priority: "high",
      text: `Increase budget on ${topGain.label} by ~20% (up ${formatChangePercent(
        topGain.deltaPercent,
      )}).`,
    });
  }
  if (params.adsSnapshot?.campaigns?.length) {
    const worst = [...params.adsSnapshot.campaigns].sort((a, b) => a.conversions - b.conversions)[0];
    if (worst && worst.conversions < 5) {
      recs.push({
        priority: "medium",
        text: `Pause underperforming ad set "${worst.campaign_name}" (${worst.conversions} conversions).`,
      });
    }
  }
  if (params.criticalAlerts.length > 0) {
    recs.push({
      priority: "medium",
      text: `Resolve ${params.criticalAlerts.length} critical reporting issue(s) before next report.`,
    });
  }
  if (params.strategistSummary) {
    recs.push({ priority: "medium", text: params.strategistSummary.theNextMove });
  }
  if (recs.length === 0) {
    recs.push({
      priority: "medium",
      text: "Maintain current pacing and continue weekly trend checks by channel.",
    });
  }
  return recs.slice(0, 5);
}

export function buildWeeklySummaryText(params: {
  clientName: string;
  website: string | null | undefined;
  urgencyScore: number;
  staleSources: ReportingFreshnessItem[];
  criticalAlerts: ReportingAlertItem[];
  watchAlerts: ReportingAlertItem[];
  actions: ReportingActionItem[];
  kpis: ReportingKpiCard[];
  keywordRows: KeywordHealthRow[];
  socialDailyRows: SocialDailySnapshot[];
  adsSnapshot: AdsSnapshot | null;
  strategistSummary: StrategistSummaryResult | null;
}): string {
  const perfRows = buildWeeklyPerformanceRows({
    socialDailyRows: params.socialDailyRows,
    keywordRows: params.keywordRows,
    adsSnapshot: params.adsSnapshot,
  });
  const rowsWithTrend = perfRows.filter(
    (row) => row.deltaPercent != null && row.deltaAbsolute != null,
  );
  const overallGainLossPercent =
    rowsWithTrend.length > 0
      ? rowsWithTrend.reduce((sum, row) => sum + (row.deltaPercent ?? 0), 0) / rowsWithTrend.length
      : 0;
  const sortedByTrend = [...rowsWithTrend].sort(
    (a, b) => (b.deltaPercent ?? -Infinity) - (a.deltaPercent ?? -Infinity),
  );
  const gains = sortedByTrend.filter((row) => (row.deltaPercent ?? 0) > 0).slice(0, 3);
  const dips = [...sortedByTrend].reverse().filter((row) => (row.deltaPercent ?? 0) < 0).slice(0, 3);
  const recommendations = buildReportRecommendations({
    perfRows,
    adsSnapshot: params.adsSnapshot,
    criticalAlerts: params.criticalAlerts,
    strategistSummary: params.strategistSummary,
  });
  return [
    "Weekly Account Summary",
    `Client: ${params.clientName}`,
    `Website: ${websiteLabel(params.website)}`,
    `Urgency score: ${params.urgencyScore}/100`,
    "",
    "1) Executive Summary",
    `- Overall gain/loss: ${formatChangePercent(overallGainLossPercent)}.`,
    `- Data freshness: ${params.staleSources.length === 0 ? "All key channels fresh." : params.staleSources.map((s) => s.label).join(", ")}`,
    "",
    "2) Gains Highlights (Top 3)",
    ...(gains.length > 0
      ? gains.map((row, index) => `${index + 1}. ${row.label}: ${formatChangePercent(row.deltaPercent)}`)
      : ["1. No positive movers with comparable prior-period data."]),
    "",
    "3) Performance Dips (Bottom 3)",
    ...(dips.length > 0
      ? dips.map((row, index) => `${index + 1}. ${row.label}: ${formatChangePercent(row.deltaPercent)}`)
      : ["1. No negative movers with comparable prior-period data."]),
    "",
    "5) AI-Powered Recommendations",
    ...recommendations.map((rec, index) => `${index + 1}. [${rec.priority}] ${rec.text}`),
    "",
    "Immediate execution queue:",
    ...(params.actions.length > 0
      ? params.actions.slice(0, 3).map((action, index) => `${index + 1}. ${action.title}`)
      : ["1. No high-priority actions detected this week."]),
  ].join("\n");
}

export type TechnicalReportingFinding = {
  id: string;
  channel: "seo" | "ads" | "sitemaps" | "social";
  title: string;
  severity: "critical" | "watch";
  detectedAt: string;
};

export function buildReportingKpis(params: {
  adsSnapshot: AdsSnapshot | null;
  ga4Snapshot?: Ga4Snapshot | null;
  gscPageMetrics: GscPageMetric[];
  gscSignals: GscSignal[];
  gscSnapshotUpdatedAt: string | null;
  socialDailyRows: SocialDailySnapshot[];
  socialPostCount: number;
  socialConnected: boolean;
  crawlIssueCount: number;
  technicalFindingCount: number;
  technicalCriticalCount?: number;
  sitemapSnapshot: SitemapSnapshot | null;
  gbpSnapshot: GbpSnapshot | null;
  gbpReviews: GbpReviewRow[];
  lighthouseFetchedAt: string | null;
  crawlUpdatedAt: string | null;
}): ReportingKpiCard[] {
  const adsTotals = params.adsSnapshot?.totals;
  const gscClicks = params.gscPageMetrics.reduce((sum, row) => sum + row.clicks, 0);
  const gscImpressions = params.gscPageMetrics.reduce((sum, row) => sum + row.impressions, 0);
  const gscWeightedPositionNumerator = params.gscPageMetrics.reduce(
    (sum, row) => sum + row.position * Math.max(1, row.impressions),
    0,
  );
  const gscWeightedPositionDenominator = params.gscPageMetrics.reduce(
    (sum, row) => sum + Math.max(1, row.impressions),
    0,
  );
  const gscAvgPosition =
    gscWeightedPositionDenominator > 0
      ? gscWeightedPositionNumerator / gscWeightedPositionDenominator
      : null;
  const gscCtr = gscImpressions > 0 ? gscClicks / gscImpressions : null;
  const socialCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();
  const socialWindow = params.socialDailyRows.filter((row) => {
    const ts = new Date(row.snapshot_date).getTime();
    return Number.isFinite(ts) && ts >= socialCutoff;
  });
  const socialReach = socialWindow.reduce((sum, row) => sum + (row.reach ?? 0), 0);
  const socialEngagement = socialWindow.reduce((sum, row) => sum + (row.engagement ?? 0), 0);
  const socialLinkClicks = socialWindow.reduce(
    (sum, row) => sum + (row.link_clicks ?? 0),
    0,
  );
  const socialFollows = socialWindow.reduce((sum, row) => sum + (row.follows ?? 0), 0);
  const socialImpressions = socialWindow.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
  const seoOpenCount = params.crawlIssueCount + params.technicalFindingCount;
  const seoCriticalCount = params.technicalCriticalCount ?? 0;
  const gscCritical = params.gscSignals.filter((signal) => signal.severity === "critical").length;
  const adsConversionRate =
    adsTotals && adsTotals.clicks > 0 ? adsTotals.conversions / adsTotals.clicks : null;
  const adsCpaMicros =
    adsTotals && adsTotals.conversions > 0
      ? adsTotals.cost_micros / adsTotals.conversions
      : null;
  const auctionRows = params.adsSnapshot?.auction_insights ?? [];
  const auctionOverlapRows = auctionRows.filter(
    (row) => typeof row.overlap_rate === "number",
  );
  const auctionOverlapAvg =
    auctionOverlapRows.length > 0
      ? auctionOverlapRows.reduce((sum, row) => sum + (row.overlap_rate ?? 0), 0) /
        auctionOverlapRows.length
      : null;
  const auctionTopImpressionShare = auctionRows
    .map((row) => row.impression_share)
    .filter((value): value is number => typeof value === "number")
    .reduce((max, value) => Math.max(max, value), -Infinity);
  const hasAuctionTopImpressionShare = Number.isFinite(auctionTopImpressionShare);
  const gbpCutoffUnix = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const gbpRecentReviews = params.gbpReviews.filter(
    (row) => typeof row.review_time_unix === "number" && row.review_time_unix >= gbpCutoffUnix,
  );
  const gbpRecentRated = gbpRecentReviews.filter((row) => typeof row.rating === "number");
  const gbpRecentAvgRating =
    gbpRecentRated.length > 0
      ? gbpRecentRated.reduce((sum, row) => sum + (row.rating ?? 0), 0) / gbpRecentRated.length
      : null;
  const byId: Record<string, Omit<ReportingKpiCard, "id">> = {
    "ads-clicks": {
      label: "Ads clicks (30d)",
      value: adsTotals ? Math.round(adsTotals.clicks).toLocaleString() : "Not synced",
      source: "ads",
      definition: "Total ad clicks in the current 30-day snapshot.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "ads-cost-30d": {
      label: "Ads Cost (30d)",
      value: adsTotals ? `$${(adsTotals.cost_micros / 1_000_000).toFixed(2)}` : "Not synced",
      source: "ads",
      definition: "Total ad spend across synced campaigns for the current 30-day window.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "ads-cpc-30d": {
      label: "Ads Avg CPC (30d)",
      value: adsTotals ? `$${(adsTotals.average_cpc / 1_000_000).toFixed(2)}` : "Not synced",
      source: "ads",
      definition: "Average cost per click from synced Google Ads campaigns.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "ads-conversion-rate-30d": {
      label: "Ads Conversion Rate (30d)",
      value:
        adsConversionRate == null
          ? "Not synced"
          : `${(adsConversionRate * 100).toFixed(2)}%`,
      source: "ads",
      definition: "Conversions divided by clicks over the current 30-day window.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "ads-cpa-30d": {
      label: "Ads CPA (30d)",
      value:
        adsCpaMicros == null
          ? "Not synced"
          : `$${(adsCpaMicros / 1_000_000).toFixed(2)}`,
      source: "ads",
      definition: "Average ad cost per conversion over the current 30-day window.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "gsc-clicks": {
      label: "Search clicks (30d)",
      value: params.gscSnapshotUpdatedAt ? gscClicks.toLocaleString() : "Not synced",
      source: "search_console",
      definition: "Total Search Console page clicks for the latest 30-day range.",
      updated_at: params.gscSnapshotUpdatedAt,
    },
    "gsc-avg-position-30d": {
      label: "Search Avg Position (30d)",
      value: gscAvgPosition == null ? "Not synced" : gscAvgPosition.toFixed(2),
      source: "search_console",
      definition:
        "Impression-weighted average Search Console position across synced page rows.",
      updated_at: params.gscSnapshotUpdatedAt,
    },
    "gsc-ctr-30d": {
      label: "Search CTR (30d)",
      value: gscCtr == null ? "Not synced" : `${(gscCtr * 100).toFixed(2)}%`,
      source: "search_console",
      definition: "Search clicks divided by impressions for the latest synced window.",
      updated_at: params.gscSnapshotUpdatedAt,
    },
    "social-reach": {
      label: "Social reach (30d)",
      value: params.socialConnected ? socialReach.toLocaleString() : "Not connected",
      source: "social",
      definition: "Summed daily social reach over the last 30 days.",
      updated_at: params.socialDailyRows[0]?.created_at ?? null,
    },
    "social-engagement": {
      label: "Social engagement (30d)",
      value: params.socialConnected ? socialEngagement.toLocaleString() : "Not connected",
      source: "social",
      definition: "Summed social engagement over the last 30 days.",
      updated_at: params.socialDailyRows[0]?.created_at ?? null,
    },
    "social-link-clicks-30d": {
      label: "Social Link Clicks (30d)",
      value: params.socialConnected ? socialLinkClicks.toLocaleString() : "Not connected",
      source: "social",
      definition: "Summed outbound link clicks from synced social insights over 30 days.",
      updated_at: params.socialDailyRows[0]?.created_at ?? null,
    },
    "social-follows-30d": {
      label: "Social Follows (30d)",
      value: params.socialConnected ? socialFollows.toLocaleString() : "Not connected",
      source: "social",
      definition: "Total follows gained from synced social insights over 30 days.",
      updated_at: params.socialDailyRows[0]?.created_at ?? null,
    },
    "social-posts-tracked": {
      label: "Social Posts Tracked (30d)",
      value: params.socialConnected ? String(params.socialPostCount) : "Not connected",
      source: "social",
      definition: "Number of social posts stored in the latest sync window.",
      updated_at: params.socialDailyRows[0]?.created_at ?? null,
    },
    "social-impressions-30d": {
      label: "Social Impressions (30d)",
      value: params.socialConnected ? socialImpressions.toLocaleString() : "Not connected",
      source: "social",
      definition: "Summed social impressions over the last 30 days.",
      updated_at: params.socialDailyRows[0]?.created_at ?? null,
    },
    "seo-open": {
      label: "SEO open issues",
      value: String(seoOpenCount),
      source: "seo",
      definition: "Combined SEO findings from technical checks and crawl results.",
      updated_at: params.lighthouseFetchedAt ?? params.crawlUpdatedAt ?? null,
    },
    "seo-critical-issues": {
      label: "SEO Critical Issues",
      value: String(seoCriticalCount),
      source: "seo",
      definition: "Count of critical-severity technical SEO findings currently detected.",
      updated_at: params.lighthouseFetchedAt ?? params.crawlUpdatedAt ?? null,
    },
    "gsc-critical": {
      label: "GSC critical signals",
      value: String(gscCritical),
      source: "search_console",
      definition: "Critical Search Console signals requiring attention.",
      updated_at: params.gscSnapshotUpdatedAt,
    },
    "sitemaps-stale": {
      label: "Stale sitemap URLs",
      value: params.sitemapSnapshot ? String(params.sitemapSnapshot.stale_90_count) : "Not synced",
      source: "sitemaps",
      definition: "URLs flagged as stale based on 90+ day age from sitemap metadata.",
      updated_at: params.sitemapSnapshot?.updated_at ?? null,
    },
    "sitemaps-url-count": {
      label: "Sitemap URL Count",
      value: params.sitemapSnapshot ? String(params.sitemapSnapshot.url_count) : "Not synced",
      source: "sitemaps",
      definition: "Total URLs discovered in the most recent sitemap sync.",
      updated_at: params.sitemapSnapshot?.updated_at ?? null,
    },
    "ads-ctr": {
      label: "Ads CTR (30d)",
      value: adsTotals ? `${(adsTotals.ctr * 100).toFixed(2)}%` : "Not synced",
      source: "ads",
      definition: "Click-through-rate from current Google Ads snapshot.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "ads-search-impression-share": {
      label: "Ads Search IS (30d)",
      value:
        adsTotals && typeof adsTotals.search_impression_share === "number"
          ? `${(adsTotals.search_impression_share * 100).toFixed(2)}%`
          : "Not synced",
      source: "ads",
      definition: "Search impression share across synced campaigns.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "ads-rank-lost-is": {
      label: "Ads Lost IS (Rank)",
      value:
        adsTotals && typeof adsTotals.search_rank_lost_impression_share === "number"
          ? `${(adsTotals.search_rank_lost_impression_share * 100).toFixed(2)}%`
          : "Not synced",
      source: "ads",
      definition: "Estimated lost search impression share due to rank.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "ads-budget-lost-is": {
      label: "Ads Lost IS (Budget)",
      value:
        adsTotals && typeof adsTotals.search_budget_lost_impression_share === "number"
          ? `${(adsTotals.search_budget_lost_impression_share * 100).toFixed(2)}%`
          : "Not synced",
      source: "ads",
      definition: "Estimated lost search impression share due to budget.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "ads-auction-competitors": {
      label: "Ads Auction Competitors",
      value: params.adsSnapshot?.auction_insights?.length
        ? String(new Set(params.adsSnapshot.auction_insights.map((row) => row.domain)).size)
        : "Not available",
      source: "ads",
      definition: "Unique competitor domains returned by auction insights.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "ads-auction-overlap-avg": {
      label: "Auction Overlap Rate (avg)",
      value:
        auctionOverlapAvg == null ? "Not available" : `${(auctionOverlapAvg * 100).toFixed(2)}%`,
      source: "ads",
      definition: "Average overlap rate across competitor domains in auction insights.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "ads-auction-top-impression-share": {
      label: "Top Competitor Impr. Share",
      value: hasAuctionTopImpressionShare
        ? `${(auctionTopImpressionShare * 100).toFixed(2)}%`
        : "Not available",
      source: "ads",
      definition: "Highest competitor impression share observed in auction insights.",
      updated_at: params.adsSnapshot?.updated_at ?? null,
    },
    "gsc-impressions": {
      label: "Search impressions (30d)",
      value: params.gscSnapshotUpdatedAt ? gscImpressions.toLocaleString() : "Not synced",
      source: "search_console",
      definition: "Total Search Console impressions for the latest sync window.",
      updated_at: params.gscSnapshotUpdatedAt,
    },
    "website-total-sessions": {
      label: "Website Sessions (30d)",
      value: ga4Kpi(params.ga4Snapshot, (t) => t.sessions, (v) => v.toLocaleString()),
      source: "ga4",
      definition: "Total GA4 sessions for the latest reporting window.",
      updated_at: params.ga4Snapshot?.updated_at ?? null,
    },
    "website-users": {
      label: "Website Users (30d)",
      value: ga4Kpi(params.ga4Snapshot, (t) => t.users, (v) => v.toLocaleString()),
      source: "ga4",
      definition: "Total GA4 users for the latest reporting window.",
      updated_at: params.ga4Snapshot?.updated_at ?? null,
    },
    "website-engagement-rate": {
      label: "Website Engagement Rate (30d)",
      value: ga4Kpi(params.ga4Snapshot, (t) => t.engagement_rate, (v) => `${(v * 100).toFixed(1)}%`),
      source: "ga4",
      definition: "GA4 engagement rate for the latest reporting window.",
      updated_at: params.ga4Snapshot?.updated_at ?? null,
    },
    "website-avg-engagement-time": {
      label: "Website Avg Engagement Time",
      value: ga4Kpi(params.ga4Snapshot, (t) => t.avg_engagement_time_seconds, (v) => formatEngagementTime(v)),
      source: "ga4",
      definition: "Average engagement time per session from GA4.",
      updated_at: params.ga4Snapshot?.updated_at ?? null,
    },
    "gbp-rating": {
      label: "GBP Rating",
      value:
        typeof params.gbpSnapshot?.rating === "number"
          ? `${params.gbpSnapshot.rating.toFixed(2)} / 5`
          : "Not synced",
      source: "gbp",
      definition: "Current Google Business Profile average review rating.",
      updated_at: params.gbpSnapshot?.updated_at ?? null,
    },
    "gbp-review-count": {
      label: "GBP Review Count",
      value:
        typeof params.gbpSnapshot?.user_ratings_total === "number"
          ? params.gbpSnapshot.user_ratings_total.toLocaleString()
          : "Not synced",
      source: "gbp",
      definition: "Total Google reviews on the connected Business Profile.",
      updated_at: params.gbpSnapshot?.updated_at ?? null,
    },
    "gbp-reviews-30d": {
      label: "GBP New Reviews (30d)",
      value: params.gbpSnapshot ? String(gbpRecentReviews.length) : "Not synced",
      source: "gbp",
      definition: "Reviews with publish time in the last 30 days.",
      updated_at: params.gbpSnapshot?.updated_at ?? null,
    },
    "gbp-review-sentiment-30d": {
      label: "GBP Review Sentiment (30d)",
      value:
        gbpRecentAvgRating == null ? "Not enough data" : `${gbpRecentAvgRating.toFixed(2)} / 5`,
      source: "gbp",
      definition: "Average star rating of recent reviews in the last 30 days.",
      updated_at: params.gbpSnapshot?.updated_at ?? null,
    },
  };
  return REPORTING_METRIC_REGISTRY.map((item) => {
    const metric = byId[item.id];
    return {
      id: item.id,
      label: metric?.label ?? item.label,
      value: metric?.value ?? "N/A",
      source: metric?.source ?? item.source,
      definition: metric?.definition ?? "No metric definition available.",
      updated_at: metric?.updated_at ?? null,
    };
  });
}

export function buildReportingFreshness(params: {
  adsUpdatedAt: string | null;
  gscUpdatedAt: string | null;
  socialUpdatedAt: string | null;
  lighthouseOrCrawlUpdatedAt: string | null;
  sitemapUpdatedAt: string | null;
  gbpUpdatedAt: string | null;
  hasGa4Property: boolean;
}): ReportingFreshnessItem[] {
  const now = Date.now();
  const getStatus = (value: string | null | undefined): ReportingFreshnessItem["status"] => {
    if (!value) return "missing";
    const ageDays = (now - new Date(value).getTime()) / (1000 * 60 * 60 * 24);
    if (!Number.isFinite(ageDays)) return "missing";
    return ageDays > 14 ? "stale" : "fresh";
  };
  return [
    { source: "ads", label: "Google Ads", updated_at: params.adsUpdatedAt, status: getStatus(params.adsUpdatedAt) },
    {
      source: "search_console",
      label: "Search Console",
      updated_at: params.gscUpdatedAt,
      status: getStatus(params.gscUpdatedAt),
    },
    { source: "social", label: "Social", updated_at: params.socialUpdatedAt, status: getStatus(params.socialUpdatedAt) },
    {
      source: "seo",
      label: "SEO (Lighthouse + Crawl)",
      updated_at: params.lighthouseOrCrawlUpdatedAt,
      status: getStatus(params.lighthouseOrCrawlUpdatedAt),
    },
    { source: "sitemaps", label: "Sitemaps", updated_at: params.sitemapUpdatedAt, status: getStatus(params.sitemapUpdatedAt) },
    {
      source: "gbp",
      label: "Google Business Profile",
      updated_at: params.gbpUpdatedAt,
      status: getStatus(params.gbpUpdatedAt),
    },
    { source: "ga4", label: "GA4", updated_at: null, status: params.hasGa4Property ? "fresh" : "missing" },
  ];
}

export function buildReportingAlerts(params: {
  technicalFindings: TechnicalReportingFinding[];
  gscSignals: GscSignal[];
  adsSignals: Array<{ id: number; title: string; severity: "critical" | "watch"; created_at: string }>;
  socialSignals: Array<{ id: number; title: string; severity: "critical" | "watch"; created_at: string }>;
}): ReportingAlertItem[] {
  const baseAlerts: ReportingAlertItem[] = params.technicalFindings.map((finding) => ({
    id: finding.id,
    source: finding.channel === "seo" ? "seo" : finding.channel === "ads" ? "ads" : finding.channel === "social" ? "social" : "sitemaps",
    title: finding.title,
    severity: finding.severity,
    detected_at: finding.detectedAt,
  }));
  const gscAlerts: ReportingAlertItem[] = params.gscSignals.map((signal) => ({
    id: `gsc-${signal.id}`,
    source: "search_console",
    title: signal.title,
    severity: signal.severity,
    detected_at: signal.created_at,
  }));
  const adsAlerts: ReportingAlertItem[] = params.adsSignals.map((signal) => ({
    id: `ads-${signal.id}`,
    source: "ads",
    title: signal.title,
    severity: signal.severity,
    detected_at: signal.created_at,
  }));
  const socialAlerts: ReportingAlertItem[] = params.socialSignals.map((signal) => ({
    id: `social-${signal.id}`,
    source: "social",
    title: signal.title,
    severity: signal.severity,
    detected_at: signal.created_at,
  }));
  return [...baseAlerts, ...gscAlerts, ...adsAlerts, ...socialAlerts]
    .sort((left, right) => {
      if (left.severity !== right.severity) return left.severity === "critical" ? -1 : 1;
      const leftTs = left.detected_at ? new Date(left.detected_at).getTime() : 0;
      const rightTs = right.detected_at ? new Date(right.detected_at).getTime() : 0;
      return rightTs - leftTs;
    })
    .slice(0, 20);
}

export function buildReportingActions(params: {
  client: ClientRow;
  freshness: ReportingFreshnessItem[];
  alerts: ReportingAlertItem[];
}): ReportingActionItem[] {
  const items: ReportingActionItem[] = [];
  if (params.client.needs_reply) {
    items.push({
      id: "reply-client",
      title: "Respond to latest client communication",
      detail: "Client-authored communication is the latest touchpoint.",
      owner: "strategist",
      priority: "high",
    });
  }
  if (!(params.client.sc_url ?? "").trim()) {
    items.push({
      id: "set-sc-url",
      title: "Set Search Console property URL",
      detail: "Search Console diagnostics are limited until this is configured.",
      owner: "strategist",
      priority: "high",
    });
  }
  if (!(params.client.ads_customer_id ?? "").trim()) {
    items.push({
      id: "set-ads-id",
      title: "Set Google Ads customer ID",
      detail: "Ads sync and campaign diagnostics need a valid customer ID.",
      owner: "strategist",
      priority: "high",
    });
  }
  for (const freshness of params.freshness) {
    if (freshness.source === "ga4") continue;
    if (freshness.status === "stale" || freshness.status === "missing") {
      items.push({
        id: `sync-${freshness.source}`,
        title: `Refresh ${freshness.label} data`,
        detail: freshness.updated_at ? `Last updated ${freshness.updated_at}.` : "No data has been synced yet.",
        owner: "ops",
        priority: freshness.status === "missing" ? "high" : "medium",
      });
    }
  }
  for (const alert of params.alerts) {
    if (alert.severity !== "critical") continue;
    items.push({
      id: `critical-${alert.id}`,
      title: `Address critical ${alert.source.replace("_", " ")} issue`,
      detail: alert.title,
      owner: alert.source === "seo" ? "help_desk" : "strategist",
      priority: "high",
    });
    if (items.length >= 8) break;
  }
  if (!(params.client.ga4_property_id ?? "").trim()) {
    items.push({
      id: "set-ga4-id",
      title: "Add GA4 property ID",
      detail: "Prepares this account for upcoming GA4 reporting sync.",
      owner: "strategist",
      priority: "low",
    });
  }
  const rank = (priority: ReportingActionItem["priority"]) => (priority === "high" ? 0 : priority === "medium" ? 1 : 2);
  return items
    .filter((item, index, all) => all.findIndex((x) => x.id === item.id) === index)
    .sort((a, b) => rank(a.priority) - rank(b.priority))
    .slice(0, 5);
}

function toPeriodMetric(
  label: string,
  current: number | null,
  previous: number | null,
  valueSuffix?: string,
  valuePrefix?: string,
): ReportPeriodMetric {
  const deltaAbsolute = current == null || previous == null ? null : current - previous;
  const deltaPercent =
    current == null || previous == null || previous === 0
      ? null
      : ((current - previous) / previous) * 100;
  return { label, current, previous, deltaAbsolute, deltaPercent, valueSuffix, valuePrefix };
}

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Coerces a possibly-missing GA4 number (real snapshots can have undefined
 *  totals fields even though the type says number). */
function gaNum(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Formats a GA4 KPI value, falling back to a clear status when not available. */
function ga4Kpi(
  snapshot: Ga4Snapshot | null | undefined,
  pick: (totals: Ga4Snapshot["totals"]) => number | null | undefined,
  fmt: (value: number) => string,
): string {
  if (!snapshot) return "Not synced";
  const value = gaNum(pick(snapshot.totals));
  return value == null ? "—" : fmt(value);
}

/** Seconds → "1m 23s" / "45s". */
function formatEngagementTime(seconds: number): string {
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function buildGa4ChannelBlock(params: {
  hasGa4Property: boolean;
  ga4Snapshot?: Ga4Snapshot | null;
}): ReportChannelBlock {
  if (!params.hasGa4Property) {
    return {
      source: "ga4",
      title: "Google Analytics 4",
      connected: false,
      status: "not_connected",
      summary: "GA4 property is not configured for this client.",
      metrics: [],
    };
  }
  const snapshot = params.ga4Snapshot;
  if (!snapshot) {
    return {
      source: "ga4",
      title: "Google Analytics 4",
      connected: true,
      status: "no_data",
      summary: "GA4 property is configured but no snapshot has been synced for this window.",
      metrics: [],
    };
  }

  const t = snapshot.totals ?? ({} as Ga4Snapshot["totals"]);
  const prev = snapshot.previous_totals;
  const rate = (v: number | null | undefined) => {
    const n = gaNum(v);
    return n == null ? null : n * 100;
  };
  const metrics: ReportPeriodMetric[] = [
    toPeriodMetric("Sessions", gaNum(t.sessions), gaNum(prev?.sessions)),
    toPeriodMetric("Users", gaNum(t.users), gaNum(prev?.users)),
    toPeriodMetric("New Users", gaNum(t.new_users), gaNum(prev?.new_users)),
    toPeriodMetric("Engagement Rate", rate(t.engagement_rate), rate(prev?.engagement_rate), "%"),
    toPeriodMetric(
      "Avg Engagement Time",
      gaNum(t.avg_engagement_time_seconds) == null ? null : Math.round(t.avg_engagement_time_seconds),
      gaNum(prev?.avg_engagement_time_seconds) == null ? null : Math.round(prev!.avg_engagement_time_seconds),
      "s",
    ),
    toPeriodMetric("Conversions", gaNum(t.conversions), gaNum(prev?.conversions)),
    toPeriodMetric("Engaged Sessions", gaNum(t.engaged_sessions), gaNum(prev?.engaged_sessions)),
    toPeriodMetric("Bounce Rate", rate(t.bounce_rate), rate(prev?.bounce_rate), "%"),
    toPeriodMetric("Conversion Rate", rate(t.session_key_event_rate), rate(prev?.session_key_event_rate), "%"),
    toPeriodMetric(
      "Avg Session Duration",
      gaNum(t.avg_session_duration_seconds) == null ? null : Math.round(t.avg_session_duration_seconds!),
      gaNum(prev?.avg_session_duration_seconds) == null ? null : Math.round(prev!.avg_session_duration_seconds!),
      "s",
    ),
    toPeriodMetric("Views per Session", gaNum(t.views_per_session), gaNum(prev?.views_per_session)),
    toPeriodMetric("Events per Session", gaNum(t.events_per_session), gaNum(prev?.events_per_session)),
  ];

  return {
    source: "ga4",
    title: "Google Analytics 4",
    connected: true,
    status: "ready",
    summary: `GA4 snapshot ${snapshot.start_date} to ${snapshot.end_date}.`,
    metrics,
    channelBreakdown: (snapshot.channel_breakdown ?? []).map((row) => ({
      channel: row.channel,
      sessions: gaNum(row.sessions) ?? 0,
      users: gaNum(row.users) ?? 0,
      engagementRate: gaNum(row.engagement_rate) ?? 0,
    })),
    topPages: (snapshot.top_pages ?? []).map((row) => ({
      pagePath: row.page_path,
      sessions: gaNum(row.sessions) ?? 0,
      engagementRate: gaNum(row.engagement_rate) ?? 0,
      avgEngagementTimeSeconds: gaNum(row.avg_engagement_time_seconds) ?? 0,
    })),
    // Pass-through breakdowns for the new toggleable report sections.
    conversionsByEvent: snapshot.conversions_by_event ?? [],
    geoBreakdown: snapshot.geo_breakdown ?? [],
    deviceBreakdown: snapshot.device_breakdown ?? [],
    sourceMediumBreakdown: snapshot.source_medium_breakdown ?? [],
    newVsReturning: snapshot.new_vs_returning ?? [],
    sessionsTrend: snapshot.sessions_trend ?? [],
    landingPages: snapshot.landing_pages ?? [],
  };
}

function buildAdsChannelBlock(params: {
  adsSnapshot: AdsSnapshot | null;
  previousAdsSnapshot?: AdsSnapshot | null;
}): ReportChannelBlock {
  const snapshot = params.adsSnapshot;
  if (!snapshot) {
    return {
      source: "ads",
      title: "Google Ads",
      connected: false,
      status: "no_data",
      summary: "No Google Ads snapshot found for this report window.",
      metrics: [],
    };
  }
  const totals = snapshot.totals;
  const prev = params.previousAdsSnapshot?.totals ?? null;
  function safeN(v: number | null | undefined): number | null {
    if (v == null || Number.isNaN(v)) return null;
    return v;
  }
  return {
    source: "ads",
    title: "Google Ads",
    connected: true,
    status: "ready",
    summary: `Ads snapshot ${snapshot.start_date} to ${snapshot.end_date}.`,
    metrics: [
      toPeriodMetric("Ad Clicks", safeN(totals.clicks), safeN(prev?.clicks)),
      toPeriodMetric("Impressions", safeN(totals.impressions), safeN(prev?.impressions)),
      toPeriodMetric("Conversions", safeN(totals.conversions), safeN(prev?.conversions)),
      toPeriodMetric(
        "Click-Through Rate",
        safeN(totals.ctr) != null ? (totals.ctr as number) * 100 : null,
        safeN(prev?.ctr) != null ? (prev!.ctr as number) * 100 : null,
        "%",
      ),
      toPeriodMetric(
        "Avg Cost Per Click",
        safeN(totals.average_cpc) != null ? (totals.average_cpc as number) / 1_000_000 : null,
        safeN(prev?.average_cpc) != null ? (prev!.average_cpc as number) / 1_000_000 : null,
        undefined,
        "$",
      ),
      toPeriodMetric("Cost Per Conversion", safeN(totals.cost_per_conversion), safeN(prev?.cost_per_conversion), undefined, "$"),
      toPeriodMetric("ROAS", safeN(totals.roas), safeN(prev?.roas)),
      toPeriodMetric("Interactions", safeN(totals.interactions), safeN(prev?.interactions)),
      toPeriodMetric("All Conversions", safeN(totals.all_conversions), safeN(prev?.all_conversions)),
      toPeriodMetric("View-Through Conv.", safeN(totals.view_through_conversions), safeN(prev?.view_through_conversions)),
      toPeriodMetric("Conversion Value", safeN(totals.conversions_value), safeN(prev?.conversions_value), undefined, "$"),
      toPeriodMetric(
        "Conversion Rate",
        safeN(totals.conversion_rate) != null ? (totals.conversion_rate as number) * 100 : null,
        safeN(prev?.conversion_rate) != null ? (prev!.conversion_rate as number) * 100 : null,
        "%",
      ),
      toPeriodMetric(
        "Impression Share",
        safeN(totals.search_impression_share) != null ? (totals.search_impression_share as number) * 100 : null,
        safeN(prev?.search_impression_share) != null ? (prev!.search_impression_share as number) * 100 : null,
        "%",
      ),
      toPeriodMetric(
        "Top Impression Share",
        safeN(totals.search_top_impression_share) != null ? (totals.search_top_impression_share as number) * 100 : null,
        safeN(prev?.search_top_impression_share) != null ? (prev!.search_top_impression_share as number) * 100 : null,
        "%",
      ),
      toPeriodMetric(
        "Abs. Top IS",
        safeN(totals.search_absolute_top_impression_share) != null ? (totals.search_absolute_top_impression_share as number) * 100 : null,
        safeN(prev?.search_absolute_top_impression_share) != null ? (prev!.search_absolute_top_impression_share as number) * 100 : null,
        "%",
      ),
      toPeriodMetric(
        "Lost IS (Rank)",
        safeN(totals.search_rank_lost_impression_share) != null ? (totals.search_rank_lost_impression_share as number) * 100 : null,
        safeN(prev?.search_rank_lost_impression_share) != null ? (prev!.search_rank_lost_impression_share as number) * 100 : null,
        "%",
      ),
      toPeriodMetric(
        "Lost IS (Budget)",
        safeN(totals.search_budget_lost_impression_share) != null ? (totals.search_budget_lost_impression_share as number) * 100 : null,
        safeN(prev?.search_budget_lost_impression_share) != null ? (prev!.search_budget_lost_impression_share as number) * 100 : null,
        "%",
      ),
    ],
  };
}

function buildSearchConsoleChannelBlock(params: {
  gscCurrentPageMetrics: GscPageMetric[];
  gscPreviousPageMetrics: GscPageMetric[];
}): ReportChannelBlock {
  if (params.gscCurrentPageMetrics.length === 0) {
    return {
      source: "search_console",
      title: "Google Search Console",
      connected: false,
      status: "no_data",
      summary: "No Search Console page metrics found for this client.",
      metrics: [],
    };
  }
  const clicks = params.gscCurrentPageMetrics.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = params.gscCurrentPageMetrics.reduce((sum, row) => sum + row.impressions, 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const prevClicks = params.gscPreviousPageMetrics.reduce((sum, row) => sum + row.clicks, 0);
  const prevImpressions = params.gscPreviousPageMetrics.reduce((sum, row) => sum + row.impressions, 0);
  const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
  const avgPosition = avg(
    params.gscCurrentPageMetrics
      .map((row) => row.position)
      .filter((value) => Number.isFinite(value)),
  );
  const prevAvgPosition = avg(
    params.gscPreviousPageMetrics
      .map((row) => row.position)
      .filter((value) => Number.isFinite(value)),
  );
  return {
    source: "search_console",
    title: "Google Search Console",
    connected: true,
    status: "ready",
    summary: "Search Console aggregates from latest synced query/page windows.",
    metrics: [
      toPeriodMetric("Clicks", clicks, prevClicks || null),
      toPeriodMetric("Impressions", impressions, prevImpressions || null),
      toPeriodMetric("CTR", ctr, prevCtr || null, "%"),
      toPeriodMetric("Average Position", avgPosition, prevAvgPosition),
    ],
  };
}

function buildKeywordRows(params: {
  managedKeywords: ManagedKeyword[];
  gscQueryMetrics: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
    created_at: string;
  }>;
}): ReportKeywordRow[] {
  const queryMap = new Map<string, typeof params.gscQueryMetrics>();
  for (const row of params.gscQueryMetrics) {
    const key = row.query.trim().toLowerCase();
    if (!queryMap.has(key)) queryMap.set(key, []);
    queryMap.get(key)!.push(row);
  }
  return params.managedKeywords
    .filter((keyword) => keyword.isActive)
    .map((keyword) => {
      const key = keyword.keyword.trim().toLowerCase();
      const rows = (queryMap.get(key) ?? []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const currentRows = rows.slice(0, 7);
      const previousRows = rows.slice(7, 14);
      const currentClicks = currentRows.reduce((sum, row) => sum + row.clicks, 0);
      const previousClicks = previousRows.reduce((sum, row) => sum + row.clicks, 0);
      const currentPosition = avg(
        currentRows.map((row) => row.position).filter((value) => Number.isFinite(value)),
      );
      const previousPosition = avg(
        previousRows.map((row) => row.position).filter((value) => Number.isFinite(value)),
      );
      const positionDelta =
        currentPosition == null || previousPosition == null ? null : currentPosition - previousPosition;
      const trend: ReportKeywordTrendPoint[] = currentRows.slice(0, 6).map((row, index) => ({
        snapshotLabel: `T-${index + 1}`,
        clicks: row.clicks,
        impressions: row.impressions,
        position: row.position,
      }));
      return {
        keyword: keyword.keyword,
        tag: keyword.tag,
        priority: keyword.priority,
        currentPosition,
        previousPosition,
        positionDelta,
        currentClicks,
        previousClicks,
        droppedBy3Plus: (positionDelta ?? 0) >= 3,
        trend,
      };
    });
}

export function buildKeywordSection(params: {
  managedKeywords: ManagedKeyword[];
  gscQueryMetrics: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
    created_at: string;
  }>;
}): ReportKeywordSection {
  const rows = buildKeywordRows(params);
  const dropped = rows.filter((row) => row.droppedBy3Plus).length;
  return {
    managedKeywords: params.managedKeywords,
    rows,
    summary:
      rows.length === 0
        ? "No managed keywords configured yet."
        : `${rows.length} tracked keyword(s), ${dropped} with position drops >= 3.`,
  };
}

export function buildClientReportModel(params: {
  client: ClientRow;
  generatedAt: string;
  reportingWindowLabel: string;
  urgencyScore: number;
  kpis: ReportingKpiCard[];
  alerts: ReportingAlertItem[];
  freshness: ReportingFreshnessItem[];
  actions: ReportingActionItem[];
  keywordRows: KeywordHealthRow[];
  socialDailyRows: SocialDailySnapshot[];
  adsSnapshot: AdsSnapshot | null;
  ga4Snapshot?: Ga4Snapshot | null;
  gbpSnapshot?: GbpSnapshot | null;
  gbpReviews?: GbpReviewRow[];
  previousAdsSnapshot?: AdsSnapshot | null;
  gscPageMetrics?: GscPageMetric[];
  gscPreviousPageMetrics?: GscPageMetric[];
  gscQueryMetrics?: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
    created_at: string;
  }>;
  managedKeywords?: ManagedKeyword[];
  socialPostSnapshots?: SocialPostSnapshot[];
  strategistSummary: StrategistSummaryResult | null;
  basecampEvents?: Array<{
    id: number;
    kind: "message" | "comment";
    occurred_at: string;
    author_email: string | null;
    is_internal: boolean;
    thread_title: string | null;
    thread_excerpt: string | null;
    thread_url: string | null;
  }>;
  playbookChecklist?: Array<{
    id: number;
    title: string;
    category: string;
    tier_key: string;
    type: "checklist" | "deliverable" | "guideline";
    status: "pass" | "fail" | "manual";
    verify_label: string | null;
  }>;
}): ClientReportModel {
  const staleSources = params.freshness.filter(
    (item) => item.source !== "ga4" && (item.status === "stale" || item.status === "missing"),
  );
  const perfRows = buildWeeklyPerformanceRows({
    socialDailyRows: params.socialDailyRows,
    keywordRows: params.keywordRows,
    adsSnapshot: params.adsSnapshot,
  });
  const charts = buildDetailedBreakdownChartData({
    socialDailyRows: params.socialDailyRows,
    perfRows,
  });
  const criticalAlerts = params.alerts.filter((alert) => alert.severity === "critical");
  const watchAlerts = params.alerts.filter((alert) => alert.severity === "watch");
  const summaryText = buildWeeklySummaryText({
    clientName: params.client.account_name,
    website: params.client.website,
    urgencyScore: params.urgencyScore,
    staleSources,
    criticalAlerts,
    watchAlerts,
    actions: params.actions,
    kpis: params.kpis,
    keywordRows: params.keywordRows,
    socialDailyRows: params.socialDailyRows,
    adsSnapshot: params.adsSnapshot,
    strategistSummary: params.strategistSummary,
  });
  const recommendations = buildReportRecommendations({
    perfRows,
    adsSnapshot: params.adsSnapshot,
    criticalAlerts,
    strategistSummary: params.strategistSummary,
  });
  const executiveRows = perfRows.filter(
    (row) => row.deltaPercent != null && row.deltaAbsolute != null,
  );
  const executiveSorted = [...executiveRows].sort(
    (a, b) => (b.deltaPercent ?? -Infinity) - (a.deltaPercent ?? -Infinity),
  );
  const topGains = executiveSorted.filter((row) => (row.deltaPercent ?? 0) > 0).slice(0, 3);
  const topDips = [...executiveSorted]
    .reverse()
    .filter((row) => (row.deltaPercent ?? 0) < 0)
    .slice(0, 3);
  const overallDeltaPercent =
    executiveRows.length === 0
      ? null
      : executiveRows.reduce((sum, row) => sum + (row.deltaPercent ?? 0), 0) / executiveRows.length;
  const ga4 = buildGa4ChannelBlock({
    hasGa4Property: hasText(params.client.ga4_property_id),
    ga4Snapshot: params.ga4Snapshot ?? null,
  });
  const ads = buildAdsChannelBlock({
    adsSnapshot: params.adsSnapshot,
    previousAdsSnapshot: params.previousAdsSnapshot,
  });
  const searchConsole = buildSearchConsoleChannelBlock({
    gscCurrentPageMetrics: params.gscPageMetrics ?? [],
    gscPreviousPageMetrics: params.gscPreviousPageMetrics ?? [],
  });
  const keywords = buildKeywordSection({
    managedKeywords: params.managedKeywords ?? [],
    gscQueryMetrics: params.gscQueryMetrics ?? [],
  });
  // Split top pages into non-blog (Search Traffic) and blog (Blog Performance),
  // each a proper top-10 from the full metrics, so blog pages don't crowd out
  // the Search Traffic list (they get their own section below).
  const toTopPageRow = (row: NonNullable<typeof params.gscPageMetrics>[number]) => ({
    page_url: row.page_url,
    clicks: row.clicks,
    impressions: row.impressions,
    position: row.position,
    ctr: row.ctr,
  });
  const isBlogPage = (url: string) => url.includes("/blog/");
  const gscPagesByClicks = (params.gscPageMetrics ?? []).slice().sort((a, b) => b.clicks - a.clicks);
  const gscTopPages = gscPagesByClicks
    .filter((row) => !isBlogPage(row.page_url))
    .slice(0, 10)
    .map(toTopPageRow);
  const gscTopBlogPages = gscPagesByClicks
    .filter((row) => isBlogPage(row.page_url))
    .slice(0, 10)
    .map(toTopPageRow);

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const topSocialPosts = (params.socialPostSnapshots ?? [])
    .filter((p) => p.published_at && p.published_at >= cutoff)
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
    .slice(0, 6);

  return {
    client: params.client,
    generatedAt: params.generatedAt,
    reportingWindowLabel: params.reportingWindowLabel,
    urgencyScore: params.urgencyScore,
    executiveSummary: {
      overallDeltaPercent,
      topGains,
      topDips,
    },
    kpis: params.kpis,
    alerts: params.alerts,
    freshness: params.freshness,
    staleSources,
    actions: params.actions,
    keywordRows: params.keywordRows,
    socialDailyRows: params.socialDailyRows,
    topSocialPosts,
    adsSnapshot: params.adsSnapshot,
    gbpSnapshot: params.gbpSnapshot ?? null,
    gbpReviews: params.gbpReviews ?? [],
    strategistSummary: params.strategistSummary,
    perfRows,
    charts,
    summaryText,
    recommendations,
    gscTopPages,
    gscTopBlogPages,
    basecampEvents: params.basecampEvents ?? [],
    playbookChecklist: params.playbookChecklist ?? [],
    channels: {
      ga4,
      ads,
      searchConsole,
      keywords,
    },
  };
}

export function computeClientUrgencyScore(params: {
  needsReply: boolean;
  staleDays: number | null;
  hasCriticalTechnical: boolean;
  hasCriticalAds: boolean;
  hasCriticalGsc: boolean;
  missingScUrl: boolean;
  missingAdsCustomerId: boolean;
  staleSourceCount: number;
}) {
  let score = 0;
  if (params.needsReply) score += 30;
  if ((params.staleDays ?? 0) >= 15) score += 20;
  if (params.hasCriticalTechnical) score += 18;
  if (params.hasCriticalAds) score += 12;
  if (params.hasCriticalGsc) score += 12;
  if (params.missingScUrl) score += 6;
  if (params.missingAdsCustomerId) score += 5;
  score += Math.min(5, params.staleSourceCount) * 3;
  return Math.max(0, Math.min(100, score));
}

function hasText(value: string | null | undefined) {
  return Boolean((value ?? "").trim());
}

export function buildBaselineTechnicalFindings(client: ClientRow): TechnicalReportingFinding[] {
  const findings: TechnicalReportingFinding[] = [];
  const now = Date.now();
  const pushFinding = (
    channel: TechnicalReportingFinding["channel"],
    title: string,
    severity: TechnicalReportingFinding["severity"],
    offsetDays: number,
  ) => {
    findings.push({
      id: `${client.id}-${channel}-${findings.length}`,
      channel,
      title,
      severity,
      detectedAt: new Date(now - offsetDays * 24 * 60 * 60 * 1000).toISOString(),
    });
  };
  if (!hasText(client.sc_url)) pushFinding("seo", "Search Console URL missing", "watch", 1);
  if ((client.days_stale ?? 0) >= 30) {
    pushFinding("seo", "Organic channel has 30+ days of low communication", "critical", 2);
  }
  if (!hasText(client.ads_customer_id)) {
    pushFinding("ads", "Google Ads customer ID not set", "watch", 1);
  }
  if (!hasText(client.website)) {
    pushFinding("sitemaps", "Website URL missing for sitemap checks", "critical", 0);
  }
  if (!hasText(client.smm)) {
    pushFinding("social", "Social media ownership/details missing", "watch", 3);
  }
  return findings;
}
