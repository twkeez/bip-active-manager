import type {
  AdsSnapshot,
  ClientRow,
  KeywordHealthRow,
  ReportingAlertItem,
  ReportingFreshnessItem,
  ReportingKpiCard,
  SocialDailySnapshot,
  SocialPostSnapshot,
  StrategistSummaryResult,
} from "@/lib/types/client";

export type ReportingActionItem = {
  id: string;
  title: string;
  detail: string;
  owner: "strategist" | "help_desk" | "ops";
  priority: "high" | "medium" | "low";
};

export type WeeklyPerfRow = {
  label: string;
  current: number;
  previous: number | null;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  category: "channel" | "campaign";
};

export type DetailedBreakdownChartData = {
  trendData: Array<{ date: string; engagement: number; reach: number }>;
  channelData: Array<{ name: string; value: number }>;
  waterfallData: Array<{ name: "Gains" | "Dips"; value: number; fill: string }>;
};

export type ReportRecommendationItem = {
  priority: "high" | "medium" | "low";
  text: string;
};

export type ClientReportModel = {
  client: ClientRow;
  generatedAt: string;
  reportingWindowLabel: string;
  urgencyScore: number;
  executiveSummary: {
    overallDeltaPercent: number | null;
    topGains: WeeklyPerfRow[];
    topDips: WeeklyPerfRow[];
  };
  kpis: ReportingKpiCard[];
  alerts: ReportingAlertItem[];
  freshness: ReportingFreshnessItem[];
  staleSources: ReportingFreshnessItem[];
  actions: ReportingActionItem[];
  keywordRows: KeywordHealthRow[];
  socialDailyRows: SocialDailySnapshot[];
  topSocialPosts: SocialPostSnapshot[];
  adsSnapshot: AdsSnapshot | null;
  strategistSummary: StrategistSummaryResult | null;
  perfRows: WeeklyPerfRow[];
  charts: DetailedBreakdownChartData;
  summaryText: string;
  recommendations: ReportRecommendationItem[];
  gscTopPages: Array<{ page_url: string; clicks: number; impressions: number; position: number; ctr: number }>;
  basecampEvents: Array<{ id: number; kind: "message" | "comment"; occurred_at: string; author_email: string | null; is_internal: boolean; thread_title: string | null; thread_excerpt: string | null; thread_url: string | null }>;
  playbookChecklist: Array<{ id: number; title: string; category: string; tier_key: string; type: "checklist" | "deliverable" | "guideline"; status: "pass" | "fail" | "manual"; verify_label: string | null }>;
  channels: {
    ga4: ReportChannelBlock;
    ads: ReportChannelBlock;
    searchConsole: ReportChannelBlock;
    keywords: ReportKeywordSection;
  };
};

export type ReportSection =
  | "cover"
  | "executive-summary"
  | "kpi-snapshot"
  | "gains-and-dips"
  | "detailed-breakdown"
  | "recommendations"
  | "action-queue";

export type ChartSeries = {
  id: "trend" | "channel-comparison" | "gains-vs-dips";
  title: string;
  points: Array<Record<string, string | number>>;
};

export type RecommendationItem = ReportRecommendationItem;

export type ActionQueueItem = ReportingActionItem;

export type ReportPeriodMetric = {
  label: string;
  current: number | null;
  previous: number | null;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  valueSuffix?: string;
  valuePrefix?: string;
};

export type ReportChannelBlock = {
  source: "ga4" | "ads" | "search_console";
  title: string;
  connected: boolean;
  status: "ready" | "not_connected" | "no_data";
  summary: string;
  metrics: ReportPeriodMetric[];
};

export type ManagedKeyword = {
  id: number;
  keyword: string;
  tag: string | null;
  priority: number;
  isActive: boolean;
};

export type ReportKeywordTrendPoint = {
  snapshotLabel: string;
  clicks: number;
  impressions: number;
  position: number | null;
};

export type ReportKeywordRow = {
  keyword: string;
  tag: string | null;
  priority: number;
  currentPosition: number | null;
  previousPosition: number | null;
  positionDelta: number | null;
  currentClicks: number;
  previousClicks: number;
  droppedBy3Plus: boolean;
  trend: ReportKeywordTrendPoint[];
};

export type ReportKeywordSection = {
  managedKeywords: ManagedKeyword[];
  rows: ReportKeywordRow[];
  summary: string;
};
