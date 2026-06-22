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
  | { key: "social_posts"; visible: boolean }
  | { key: "gbp"; visible: boolean }
  | { key: "ga4_conversions"; visible: boolean }
  | { key: "ga4_geography"; visible: boolean }
  | { key: "ga4_device"; visible: boolean }
  | { key: "ga4_source_medium"; visible: boolean }
  | { key: "ga4_new_vs_returning"; visible: boolean }
  | { key: "ga4_trend"; visible: boolean }
  | { key: "ga4_landing"; visible: boolean };

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
  gbp: "Google Business Profile",
  ga4_conversions: "GA4 — Conversions by Event",
  ga4_geography: "GA4 — Geography",
  ga4_device: "GA4 — Device",
  ga4_source_medium: "GA4 — Source / Medium",
  ga4_new_vs_returning: "GA4 — New vs Returning",
  ga4_trend: "GA4 — Sessions Trend",
  ga4_landing: "GA4 — Landing Pages",
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
            users: true,
            new_users: true,
            engagement_rate: true,
            avg_engagement_time: true,
            conversions: true,
            engaged_sessions: true,
            bounce_rate: true,
            conversion_rate: true,
            avg_session_duration: false,
            views_per_session: false,
            events_per_session: false,
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
    { key: "gbp", visible: true },
    { key: "ga4_conversions", visible: true },
    { key: "ga4_geography", visible: true },
    { key: "ga4_device", visible: true },
    { key: "ga4_source_medium", visible: false },
    { key: "ga4_new_vs_returning", visible: true },
    { key: "ga4_trend", visible: true },
    { key: "ga4_landing", visible: false },
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
    users: "Users",
    new_users: "New Users",
    engagement_rate: "Engagement Rate",
    avg_engagement_time: "Avg Engagement Time",
    conversions: "Conversions",
    engaged_sessions: "Engaged Sessions",
    bounce_rate: "Bounce Rate",
    conversion_rate: "Conversion Rate",
    avg_session_duration: "Avg Session Duration",
    views_per_session: "Views per Session",
    events_per_session: "Events per Session",
  },
  social: {
    reach: "People Reached",
    engagements: "Engagements",
    impressions: "Impressions",
    link_clicks: "Link Clicks",
    new_followers: "New Followers",
  },
};

/**
 * Merges a saved config with DEFAULT_REPORT_CONFIG so newly-added sections and
 * metric toggles appear for clients whose saved config predates them. Saved
 * visibility choices win; new keys take their default value.
 */
export function mergeReportConfig(saved: ReportConfig | null | undefined): ReportConfig {
  if (!saved?.sections?.length) return DEFAULT_REPORT_CONFIG;
  const savedByKey = new Map(saved.sections.map((s) => [s.key, s]));
  const sections: SectionConfig[] = [];

  for (const def of DEFAULT_REPORT_CONFIG.sections) {
    const existing = savedByKey.get(def.key);
    if (!existing) {
      sections.push(def);
      continue;
    }
    if (def.key === "kpis" && existing.key === "kpis") {
      const exSubByKey = new Map(existing.subsections.map((s) => [s.key, s]));
      const subsections = def.subsections.map((defSub) => {
        const exSub = exSubByKey.get(defSub.key);
        if (!exSub) return defSub;
        // Default keys present (so new metrics get a toggle); saved values win.
        return { ...exSub, metrics: { ...defSub.metrics, ...exSub.metrics } };
      });
      sections.push({ ...existing, subsections });
    } else {
      sections.push(existing);
    }
  }

  // Preserve any saved sections not present in defaults.
  for (const s of saved.sections) {
    if (!DEFAULT_REPORT_CONFIG.sections.some((d) => d.key === s.key)) sections.push(s);
  }

  return { sections };
}
