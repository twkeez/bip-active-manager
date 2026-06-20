export type MetricVisibility = Record<string, boolean>;

export type SubsectionConfig = {
  key: string;
  label: string;
  visible: boolean;
  metrics: MetricVisibility;
};

export type SectionConfig =
  | { key: "kpis"; visible: boolean; subsections: SubsectionConfig[] }
  | { key: "gsc_trend"; visible: boolean }
  | { key: "gsc_top_pages"; visible: boolean }
  | { key: "blog"; visible: boolean }
  | { key: "keywords"; visible: boolean }
  | { key: "social"; visible: boolean; metrics: MetricVisibility }
  | { key: "social_trend"; visible: boolean }
  | { key: "social_posts"; visible: boolean };

export type ReportConfig = {
  sections: SectionConfig[];
};

export const SECTION_LABELS: Record<string, string> = {
  kpis: "Performance Overview",
  gsc_trend: "Search Performance Trend",
  gsc_top_pages: "Search Traffic",
  blog: "Blog Performance",
  keywords: "Keyword Rankings",
  social: "Social Media",
  social_trend: "Social Trend",
  social_posts: "Top Posts",
};

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  sections: [
    {
      key: "kpis",
      visible: true,
      subsections: [
        {
          key: "organic_search",
          label: "Organic Search",
          visible: true,
          metrics: {
            clicks: true,
            impressions: true,
            ctr: true,
            avg_position: true,
          },
        },
        {
          key: "google_ads",
          label: "Google Ads",
          visible: true,
          metrics: {
            ad_clicks: true,
            impressions: true,
            conversions: true,
            ctr: true,
            avg_cpc: true,
            cost_per_conversion: true,
            interactions: false,
            all_conversions: false,
            view_through_conversions: false,
            conversions_value: false,
            conversion_rate: false,
            roas: false,
            search_impression_share: false,
            search_top_impression_share: false,
            search_absolute_top_impression_share: false,
            search_rank_lost_impression_share: false,
            search_budget_lost_impression_share: false,
          },
        },
        {
          key: "ga4",
          label: "Website Traffic (GA4)",
          visible: true,
          metrics: {
            sessions: true,
            new_users: true,
            avg_session_duration: true,
          },
        },
      ],
    },
    { key: "gsc_trend", visible: true },
    { key: "gsc_top_pages", visible: true },
    { key: "blog", visible: true },
    { key: "keywords", visible: true },
    {
      key: "social",
      visible: true,
      metrics: {
        reach: true,
        engagements: true,
        impressions: true,
        link_clicks: true,
        new_followers: true,
      },
    },
    { key: "social_trend", visible: true },
    { key: "social_posts", visible: true },
  ],
};

// Metric display labels for the edit UI
export const METRIC_LABELS: Record<string, Record<string, string>> = {
  organic_search: {
    clicks: "Organic Clicks",
    impressions: "Impressions",
    ctr: "Click-Through Rate",
    avg_position: "Avg Search Position",
  },
  google_ads: {
    ad_clicks: "Ad Clicks",
    impressions: "Impressions",
    conversions: "Conversions",
    ctr: "Click-Through Rate",
    avg_cpc: "Avg Cost Per Click",
    cost_per_conversion: "Cost Per Conversion",
    interactions: "Interactions",
    all_conversions: "All Conversions",
    view_through_conversions: "View-Through Conv.",
    conversions_value: "Conversion Value",
    conversion_rate: "Conversion Rate",
    roas: "ROAS",
    search_impression_share: "Impression Share",
    search_top_impression_share: "Top Impression Share",
    search_absolute_top_impression_share: "Abs. Top IS",
    search_rank_lost_impression_share: "Lost IS (Rank)",
    search_budget_lost_impression_share: "Lost IS (Budget)",
  },
  ga4: {
    sessions: "Sessions",
    new_users: "New Users",
    avg_session_duration: "Avg Session Duration",
  },
  social: {
    reach: "People Reached",
    engagements: "Engagements",
    impressions: "Impressions",
    link_clicks: "Link Clicks",
    new_followers: "New Followers",
  },
};
