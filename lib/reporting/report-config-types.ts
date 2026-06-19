export type MetricVisibility = Record<string, boolean>;

export type SubsectionConfig = {
  key: string;
  label: string;
  visible: boolean;
  metrics: MetricVisibility;
};

export type SectionConfig =
  | { key: "kpis"; visible: boolean; subsections: SubsectionConfig[] }
  | { key: "gsc_top_pages"; visible: boolean }
  | { key: "keywords"; visible: boolean }
  | { key: "social"; visible: boolean; metrics: MetricVisibility };

export type ReportConfig = {
  sections: SectionConfig[];
};

export const SECTION_LABELS: Record<string, string> = {
  kpis: "Performance Overview",
  gsc_top_pages: "Search Traffic",
  keywords: "Keyword Rankings",
  social: "Social Media",
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
    { key: "gsc_top_pages", visible: true },
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
