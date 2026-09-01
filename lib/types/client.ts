export type ClientRow = {
  id: number;
  /** Internal identifier — what the team searches by. May carry a group prefix. */
  account_name: string;
  /** Client-facing name for generated copy. NULL = fall back to account_name.
   *  Resolve with getClientDisplayName() from @/lib/clients/display-name. */
  public_name: string | null;
  /** In onboarding and blocked on their website going live before services start. */
  awaiting_website_launch: boolean;
  marketing_strategist: string | null;
  total_package_hours: number | null;
  hours_for_strategist: number | null;
  blog: string | null;
  smm: string | null;
  seo: string | null;
  ppc: string | null;
  orm: string | null;
  ads_customer_id: string | null;
  meta_ad_account_id?: string | null;
  ga4_id: string | null;
  sc_url: string | null;
  website: string | null;
  ga4_property_id: string | null;
  google_place_id: string | null;
  basecamp_project_id: string | null;
  harvest_project_id: string | null;
  harvest_client_id: string | null;
  tier: string | null;
  /**
   * Quiet accounts: no Basecamp or Harvest expected, shown as Paused. Moved off
   * the free-text `tier` column so plan tiers can be retired without taking this
   * with them — see lib/clients/service-active.ts.
   */
  is_low_contact?: boolean | null;
  /**
   * Website-build-only account. Hidden from the client lists behind a toggle —
   * see lib/clients/service-active.ts. Also moved off `tier`.
   */
  is_website_only?: boolean | null;
  city?: string | null;
  last_communication_at: string | null;
  last_event_is_internal: boolean | null;
  needs_reply: boolean;
  reply_acknowledged_at: string | null;
  reply_acknowledged_for_occurred_at: string | null;
  days_stale: number | null;
  onboarding_status: "active" | "complete" | null;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;
  onboarding_target_date: string | null;
  strategist_user_id?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  shared_drive_url?: string | null;
  gtm_container_id?: string | null;
  /** When a report was last produced for this client. NULL = never. */
  last_report_run_at?: string | null;
  created_at: string;
};

export type GbpSnapshot = {
  id: number;
  client_id: number;
  place_id: string;
  place_name: string | null;
  profile_url: string | null;
  website_url: string | null;
  address: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  last_post_at: string | null;
  profile_fields: Record<string, boolean> | null;
  run_status: "running" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type GbpReviewRow = {
  id: number;
  client_id: number;
  snapshot_id: number;
  author_name: string | null;
  rating: number | null;
  text: string | null;
  relative_time_description: string | null;
  review_time_unix: number | null;
  created_at: string;
};

export type ClientInsert = Omit<
  ClientRow,
  | "id"
  | "created_at"
  | "last_communication_at"
  | "last_event_is_internal"
  | "needs_reply"
  | "reply_acknowledged_at"
  | "reply_acknowledged_for_occurred_at"
  | "days_stale"
  // Optional on insert — both have database defaults.
  | "public_name"
  | "awaiting_website_launch"
> & { public_name?: string | null; awaiting_website_launch?: boolean };

export type BasecampSyncState = {
  id: number;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export type BasecampThreadEvent = {
  id: number;
  client_id: number;
  basecamp_project_id: string;
  basecamp_recording_id: number;
  parent_recording_id: number | null;
  kind: "message" | "comment";
  occurred_at: string;
  author_email: string | null;
  is_internal: boolean;
  thread_title: string | null;
  thread_excerpt: string | null;
  thread_body: string | null;
  thread_url: string | null;
};

export type LighthouseSnapshot = {
  client_id: number;
  url: string;
  fetched_at: string;
  seo_blockers: LighthouseAuditItem[];
  helpdesk_items: LighthouseAuditItem[];
  scores: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
  };
  metrics: {
    fcp: string | null;
    lcp: string | null;
    cls: string | null;
    tbt: string | null;
    speedIndex: string | null;
  };
  updated_at: string;
};

export type LighthouseAuditItem = {
  id: string;
  title: string;
  description: string | null;
  score: number | null;
  display_value: string | null;
  severity: "critical" | "watch";
  occurrences: LighthouseAuditOccurrence[];
};

export type LighthouseAuditOccurrence = {
  occurrence_key: string | null;
  source_type: "node" | "table" | "opportunity" | "unknown";
  snippet: string | null;
  selector: string | null;
  explanation: string | null;
  location: string | null;
  offending_value: string | null;
};

export type LighthouseOccurrenceOverride = {
  id: number;
  client_id: number;
  audit_id: string;
  occurrence_key: string;
  decision: "no_fix_needed";
  created_at: string;
};

export type SeoCrawlPageFact = {
  url: string;
  status: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  noindex: boolean;
  schemaTypes: string[];
};

export type SeoSchemaGap = {
  key: string;
  label: string;
  severity: "critical" | "watch";
  status: "missing" | "imprecise";
  found: string | null;
  suggestion: string;
  why: string;
};

export type SeoCrawlSnapshot = {
  id: number;
  client_id: number;
  base_url: string;
  started_at: string;
  finished_at: string | null;
  max_urls: number;
  crawled_urls: number;
  run_status: "running" | "completed" | "failed";
  error_message: string | null;
  /** What each page says. Empty for crawls run before this was stored. */
  pages: SeoCrawlPageFact[];
  schema_gaps: SeoSchemaGap[];
  /** Why the crawl ended. Null for crawls run before this was recorded. */
  stopped_because: "complete" | "page-limit" | "time-limit" | null;
  created_at: string;
  updated_at: string;
};

export type SeoCrawlIssue = {
  id: number;
  client_id: number;
  snapshot_id: number;
  rule_id: string;
  severity: "critical" | "watch";
  category: "crawl" | "onpage" | "performance" | "indexability";
  title: string;
  description: string | null;
  suggestion: string | null;
  url: string | null;
  location: string | null;
  evidence: string | null;
  occurrence_key: string;
  created_at: string;
};

export type GscSnapshot = {
  id: number;
  client_id: number;
  property_url: string;
  start_date: string;
  end_date: string;
  run_status: "running" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type GscPageMetric = {
  id: number;
  client_id: number;
  snapshot_id: number;
  page_url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  created_at: string;
};

export type GscQueryMetric = {
  id: number;
  client_id: number;
  snapshot_id: number;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  created_at: string;
};

export type GscSignal = {
  id: number;
  client_id: number;
  snapshot_id: number;
  signal_id: string;
  severity: "critical" | "watch";
  title: string;
  description: string | null;
  suggestion: string | null;
  page_url: string | null;
  query: string | null;
  metric_value: string | null;
  occurrence_key: string;
  created_at: string;
};

export type SitemapSnapshot = {
  id: number;
  client_id: number;
  sitemap_url: string;
  fetched_at: string;
  run_status: "completed" | "failed";
  error_message: string | null;
  url_count: number;
  with_lastmod_count: number;
  latest_lastmod: string | null;
  stale_90_count: number;
  created_at: string;
  updated_at: string;
};

export type SitemapUrlRow = {
  id: number;
  client_id: number;
  snapshot_id: number;
  loc: string;
  lastmod: string | null;
  http_last_modified: string | null;
  effective_updated_at: string | null;
  is_stale_90: boolean;
  created_at: string;
};

export type SocialConnection = {
  id: number;
  client_id: number;
  platform: "facebook" | "instagram";
  page_id: string | null;
  ig_user_id: string | null;
  account_username: string | null;
  account_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SocialDailySnapshot = {
  id: number;
  client_id: number;
  connection_id: number | null;
  platform: "facebook" | "instagram";
  snapshot_date: string;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
  profile_visits: number | null;
  follows: number | null;
  link_clicks: number | null;
  created_at: string;
};

export type SocialPostSnapshot = {
  id: number;
  client_id: number;
  connection_id: number | null;
  platform: "facebook" | "instagram";
  post_id: string;
  media_type: string | null;
  permalink: string | null;
  caption: string | null;
  published_at: string | null;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  link_clicks: number | null;
  created_at: string;
  updated_at: string;
};

export type SocialSignal = {
  id: number;
  client_id: number;
  platform: "facebook" | "instagram" | "combined";
  signal_id: string;
  severity: "critical" | "watch";
  title: string;
  description: string | null;
  suggestion: string | null;
  metric_value: string | null;
  created_at: string;
};

export type SocialIdea = {
  id: string;
  theme: string;
  objective: string;
  hook: string;
  format: string;
  cta: string;
  suggested_window: string;
};

export type AdsCampaignMetric = {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  interactions?: number;
  cost_micros: number;
  conversions: number;
  all_conversions?: number;
  view_through_conversions?: number;
  conversions_value?: number;
  phone_calls?: number;
  phone_impressions?: number;
  ctr: number;
  search_impression_share?: number | null;
  search_rank_lost_impression_share?: number | null;
  search_budget_lost_impression_share?: number | null;
  search_top_impression_share?: number | null;
  search_absolute_top_impression_share?: number | null;
};

export type AdsAuctionInsightRow = {
  campaign_id: string;
  campaign_name: string;
  domain: string;
  impression_share: number | null;
  overlap_rate: number | null;
  position_above_rate: number | null;
  top_of_page_rate: number | null;
  outranking_share: number | null;
};

// One row from the Google Ads call_view resource — an individual phone call
// driven by call assets. Google exposes area code + duration + status, not the
// caller's full number.
export type AdsCallRow = {
  resource_name: string;
  campaign_name: string;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number;
  status: string; // e.g. RECEIVED / MISSED
  call_type: string;
  caller_area_code: string | null;
  caller_country_code: string | null;
  display_location: string; // AD / LANDING_PAGE
};

export type AdsQualityBucket =
  | "BELOW_AVERAGE"
  | "AVERAGE"
  | "ABOVE_AVERAGE"
  | "UNKNOWN"
  | null;

export type AdsKeywordQualityRow = {
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  criterion_id: string;
  keyword: string;
  match_type: string;
  quality_score: number | null;
  ad_relevance: AdsQualityBucket;
  landing_page_experience: AdsQualityBucket;
  expected_ctr: AdsQualityBucket;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
};

export type AdsSnapshot = {
  id: number;
  client_id: number;
  customer_id: string;
  start_date: string;
  end_date: string;
  run_status: "running" | "completed" | "failed";
  error_message: string | null;
  totals: {
    impressions: number;
    clicks: number;
    interactions?: number;
    cost_micros: number;
    conversions: number;
    all_conversions?: number;
    view_through_conversions?: number;
    conversions_value?: number;
    phone_calls?: number;
    phone_impressions?: number;
    ctr: number;
    average_cpc: number;
    conversion_rate?: number | null;
    cost_per_conversion?: number | null;
    roas?: number | null;
    search_impression_share?: number | null;
    search_rank_lost_impression_share?: number | null;
    search_budget_lost_impression_share?: number | null;
    search_top_impression_share?: number | null;
    search_absolute_top_impression_share?: number | null;
  };
  campaigns: AdsCampaignMetric[];
  auction_insights?: AdsAuctionInsightRow[];
  keyword_quality?: AdsKeywordQualityRow[];
  calls?: AdsCallRow[];
  created_at: string;
  updated_at: string;
};

// Meta (Facebook/Instagram) paid ads. "Results" are the normalized conversion
// actions we care about for vet practices (link clicks, leads, messages,
// purchases), pulled out of the Graph API `actions`/`cost_per_action_type`
// arrays. All monetary values are already in dollars (unlike Google's micros).
export type MetaAdsTotals = {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number; // percent, e.g. 1.01
  cpc: number; // dollars
  cpm: number; // dollars
  link_clicks: number | null;
  leads: number | null;
  messaging_conversations_started: number | null;
  purchases: number | null;
  cost_per_link_click: number | null;
  cost_per_lead: number | null;
  cost_per_messaging_conversation: number | null;
  cost_per_purchase: number | null;
  purchase_roas: number | null;
};

export type MetaAdsCampaignMetric = {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  link_clicks: number | null;
  leads: number | null;
  messaging_conversations_started: number | null;
  purchases: number | null;
};

export type MetaAdsSnapshot = {
  id: number;
  client_id: number;
  ad_account_id: string;
  ad_account_name: string | null;
  start_date: string;
  end_date: string;
  run_status: "running" | "completed" | "failed";
  error_message: string | null;
  totals: MetaAdsTotals;
  campaigns: MetaAdsCampaignMetric[];
  created_at: string;
  updated_at: string;
};

export type AdsSignal = {
  id: number;
  client_id: number;
  snapshot_id: number;
  signal_id: string;
  severity: "critical" | "watch";
  title: string;
  description: string | null;
  suggestion: string | null;
  metric_value: string | null;
  occurrence_key: string;
  created_at: string;
};

export type Ga4ChannelRow = {
  channel: string;
  sessions: number;
  users: number;
  engagement_rate: number;
};

export type Ga4PageRow = {
  page_path: string;
  sessions: number;
  engagement_rate: number;
  avg_engagement_time_seconds: number;
};

export type Ga4Totals = {
  sessions: number;
  users: number;
  new_users: number;
  engagement_rate: number;
  avg_engagement_time_seconds: number;
  conversions: number;
  // Engagement-quality metrics (added with the expanded GA4 reporting). Optional
  // so snapshots synced before the expansion still type-check.
  engaged_sessions?: number;
  bounce_rate?: number;
  avg_session_duration_seconds?: number;
  views_per_session?: number;
  events_per_session?: number;
  session_key_event_rate?: number; // conversions ÷ sessions
};

export type Ga4ConversionRow = {
  event_name: string;
  conversions: number;
};

export type Ga4GeoRow = {
  city: string;
  region: string;
  sessions: number;
  users: number;
};

export type Ga4DeviceRow = {
  device: string;
  sessions: number;
  engagement_rate: number;
};

export type Ga4SourceMediumRow = {
  source_medium: string;
  sessions: number;
  conversions: number;
};

export type Ga4NewVsReturningRow = {
  cohort: string; // "new" | "returning" | "(unknown)"
  sessions: number;
  users: number;
};

export type Ga4TrendPoint = {
  date: string; // YYYY-MM-DD
  sessions: number;
};

export type Ga4LandingPageRow = {
  landing_page: string;
  sessions: number;
  engagement_rate: number;
};

export type Ga4Snapshot = {
  id: number;
  client_id: number;
  property_id: string;
  start_date: string;
  end_date: string;
  run_status: "running" | "completed" | "failed";
  error_message: string | null;
  totals: Ga4Totals;
  previous_totals: Ga4Totals | null;
  channel_breakdown: Ga4ChannelRow[];
  top_pages: Ga4PageRow[];
  // Expanded breakdowns (optional — older snapshots predate these columns).
  conversions_by_event?: Ga4ConversionRow[];
  geo_breakdown?: Ga4GeoRow[];
  device_breakdown?: Ga4DeviceRow[];
  source_medium_breakdown?: Ga4SourceMediumRow[];
  new_vs_returning?: Ga4NewVsReturningRow[];
  sessions_trend?: Ga4TrendPoint[];
  landing_pages?: Ga4LandingPageRow[];
  created_at: string;
  updated_at: string;
};

export type Ga4Signal = {
  id: number;
  client_id: number;
  snapshot_id: number;
  signal_id: string;
  severity: "critical" | "watch";
  title: string;
  description: string | null;
  suggestion: string | null;
  metric_value: string | null;
  occurrence_key: string;
  created_at: string;
};

export type Ga4SignalDraft = {
  signal_id: string;
  severity: "critical" | "watch";
  title: string;
  description: string | null;
  suggestion: string | null;
  metric_value: string | null;
  occurrence_key: string;
};

export type AdsSnapshotSignalDraft = {
  signal_id: string;
  severity: "critical" | "watch";
  title: string;
  description: string | null;
  suggestion: string | null;
  metric_value: string | null;
  occurrence_key: string;
};

export type AdsAuditKeywordRow = {
  keyword: string;
  match_type: string;
  campaign_name: string;
  ad_group_name: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  ctr: number;
  conversion_rate: number | null;
  cpa_micros: number | null;
  quality_score: number | null;
  ad_relevance: AdsQualityBucket;
  landing_page_experience: AdsQualityBucket;
  expected_ctr: AdsQualityBucket;
  notes: string | null;
};

export type AdsAuditMatchTypeMix = {
  broad_spend_share: number;
  phrase_spend_share: number;
  exact_spend_share: number;
  other_spend_share: number;
  broad_keyword_count: number;
  phrase_keyword_count: number;
  exact_keyword_count: number;
  flag_broad_dominant: boolean;
};

export type AdsAuditSearchTermRow = {
  search_term: string;
  campaign_name: string;
  ad_group_name: string;
  keyword_text: string | null;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
};

export type AdsAuditDeviceRow = {
  device: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  ctr: number;
};

export type AdsAuditGeoRow = {
  location_id: string;
  location_type: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  ctr: number;
};

export type AdsAuditScheduleRow = {
  day_of_week: string;
  hour: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
};

export type AdsCampaignMetaRow = {
  campaign_id: string;
  campaign_name: string;
  advertising_channel_type: string;
  bidding_strategy_type: string;
  impressions: number;
  cost_micros: number;
  conversions: number;
};

export type AdsAuditConversionAction = {
  name: string;
  type: string;
  category: string;
  counting_type: string;
  status: string;
};

export type AdsAuditPriority = {
  rank: number;
  title: string;
  rationale: string;
  severity: "critical" | "watch" | "info";
};

export type AdsAuditReport = {
  generated_at: string;
  account_name: string;
  date_range: { start: string; end: string };
  executive_snapshot: {
    spend_micros: number;
    clicks: number;
    impressions: number;
    conversions: number;
    ctr: number;
    conversion_rate: number | null;
    average_cpc_micros: number | null;
    cost_per_conversion_micros: number | null;
  };
  match_type_mix: AdsAuditMatchTypeMix;
  top_keywords: AdsAuditKeywordRow[];
  waste_keywords: AdsAuditKeywordRow[];
  quality_score: {
    summary: {
      total_keywords: number;
      flagged_keywords: number;
      landing_page_below_average: number;
      ad_relevance_below_average: number;
      expected_ctr_below_average: number;
      quality_score_low: number;
    };
    low_quality_keywords: AdsAuditKeywordRow[];
  };
  search_terms: {
    top_converting: AdsAuditSearchTermRow[];
    waste_terms: AdsAuditSearchTermRow[];
    drift_terms: AdsAuditSearchTermRow[];
    negative_candidates: string[];
  };
  devices: {
    rows: AdsAuditDeviceRow[];
    best_device: string | null;
    worst_device: string | null;
  };
  geography: {
    top_locations: AdsAuditGeoRow[];
    waste_locations: AdsAuditGeoRow[];
  };
  schedule: {
    best_windows: Array<AdsAuditScheduleRow & { cpa_micros: number | null }>;
    worst_windows: Array<AdsAuditScheduleRow & { cpa_micros: number | null }>;
  };
  account_metadata: {
    campaigns: AdsCampaignMetaRow[];
    conversion_actions: AdsAuditConversionAction[];
  };
  missing_data: string[];
  priorities: AdsAuditPriority[];
};

export type AdsAuditSnapshot = {
  id: number;
  client_id: number;
  ads_snapshot_id: number | null;
  start_date: string;
  end_date: string;
  report: AdsAuditReport;
  narrative_markdown: string | null;
  run_status: "running" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

// ── Google Ads AI Assessment ───────────────────────────────────────────────
// Structured, prioritized analysis produced by Claude from the audit data.
// Rendered as an interactive section inside the client's Ads tab.
export type AdsAssessmentPriority = "critical" | "high" | "medium" | "low";

export type AdsAssessmentActionItem = {
  priority: AdsAssessmentPriority;
  title: string;
  explanation: string;
  estimated_monthly_impact: string;
  category: "geography" | "keywords" | "negatives" | "placements" | "structure" | "bidding" | "creative";
};

export type AdsAssessmentGeoArea = {
  name: string;
  spend: number;
  conversions: number;
  cost_per_conv: number | null;
  vs_best_area_multiplier: number | null;
  recommendation: "keep" | "consider" | "remove";
};

export type AdsAssessmentKeywordFlag = {
  keyword: string;
  campaign: string;
  spend: number;
  conversions: number;
  cost_per_conv: number | null;
  issue: string;
  action: "pause" | "switch_to_phrase" | "switch_to_exact" | "reduce_bid" | "monitor";
};

export type AdsAssessment = {
  summary: {
    period: string;
    total_spend: number;
    annualized_spend: number;
    total_conversions: number;
    avg_cost_per_conv: number | null;
    impression_share: string;
    headline: string;
  };
  campaigns: Array<{
    name: string;
    spend: number;
    conversions: number;
    cost_per_conv: number | null;
    impression_share_lost_rank_pct: number | null;
    impression_share_lost_budget_pct: number | null;
    health: "good" | "fair" | "poor";
  }>;
  geographic: {
    best_area: string;
    best_area_cost_per_conv: number | null;
    areas: AdsAssessmentGeoArea[];
    estimated_monthly_waste_from_poor_areas: number;
  };
  search_term_waste: {
    irrelevant_categories: Array<{
      category: string;
      term_count: number;
      estimated_spend: number;
      example_terms: string[];
    }>;
    total_estimated_waste: number;
  };
  keyword_flags: AdsAssessmentKeywordFlag[];
  ad_schedule: {
    best_hours: Array<{ hour: number; cost_per_conv: number | null }>;
    worst_hours: Array<{ hour: number; cost_per_conv: number | null; spend: number }>;
    best_days: string[];
    worst_days: string[];
    daypart_recommendation: string;
  };
  competitive_position: {
    our_impression_share: string;
    competitors: Array<{ domain: string; impression_share: string; position_above_rate: string }>;
    summary: string;
  };
  service_gaps: Array<{ service: string; issue: string; recommendation: string }>;
  action_items: AdsAssessmentActionItem[];
};

export type AdsAssessmentSnapshot = {
  id: number;
  client_id: number;
  ads_snapshot_id: number | null;
  audit_snapshot_id: number | null;
  start_date: string;
  end_date: string;
  assessment: AdsAssessment | Record<string, never>;
  run_status: "running" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportingFreshnessItem = {
  source: "ads" | "search_console" | "social" | "seo" | "sitemaps" | "ga4" | "gbp";
  label: string;
  updated_at: string | null;
  status: "fresh" | "stale" | "missing";
};

export type ReportingKpiCard = {
  id: string;
  label: string;
  value: string;
  source:
    | "ads"
    | "meta_ads"
    | "search_console"
    | "social"
    | "seo"
    | "sitemaps"
    | "ga4"
    | "gbp"
    | "internal";
  definition: string;
  updated_at: string | null;
};

export type ReportingAlertItem = {
  id: string;
  source: "ads" | "search_console" | "social" | "seo" | "sitemaps" | "gbp" | "internal";
  title: string;
  severity: "critical" | "watch";
  detected_at: string | null;
};

export type KeywordHealthRow = {
  keyword: string;
  page_url: string | null;
  current_position: number | null;
  previous_position: number | null;
  position_delta: number;
  current_clicks: number;
  previous_clicks: number;
  current_impressions: number;
  previous_impressions: number;
  dropped_by_3_plus: boolean;
};

export type ClientKeywordTarget = {
  id: number;
  owner_user_id: string;
  client_id: number;
  keyword: string;
  tag: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientReportingMetricPreference = {
  id: number;
  owner_user_id: string;
  client_id: number;
  metric_id: string;
  is_enabled: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type StrategistSummaryResult = {
  theWin: string;
  theConcern: string;
  theNextMove: string;
};

export type UserTaskStatus =
  | "not_started"
  | "in_progress"
  | "waiting_on_client"
  | "done";
export type UserTaskPriority = "low" | "medium" | "high";
export type UserTaskSourceType = "manual" | "basecamp" | "email" | "plan";

export type UserTask = {
  id: number;
  owner_user_id: string;
  title: string;
  notes: string | null;
  description: string | null;
  status: UserTaskStatus;
  priority: UserTaskPriority;
  due_date: string | null;
  category_id: number | null;
  client_id: number | null;
  project_id: number | null;
  phase_id: number | null;
  is_starred: boolean;
  source_type: UserTaskSourceType;
  created_at: string;
  updated_at: string;
};

export type ProjectTasksGrouped = {
  phases: Array<{
    phase: ClientProjectPhase;
    tasks: UserTask[];
    doneCount: number;
    totalCount: number;
  }>;
  unassigned: UserTask[];
};

export type PlanApplyPreview = {
  phasesToCreate: string[];
  phasesExisting: number;
  tasksToCreate: Array<{ title: string; phaseTitle: string }>;
  tasksToUpdate: Array<{ title: string; phaseTitle: string }>;
  tasksSkipped: number;
};

export type ProjectHealthSummary = {
  openTaskCount: number;
  overdueTaskCount: number;
  nextDueDate: string | null;
  daysToTargetEnd: number | null;
  taskCompletionPercent: number;
};

export type UserTaskCategory = {
  id: number;
  owner_user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type TaskClientOption = {
  id: number;
  account_name: string;
};

export type UserTaskSource = {
  id: number;
  owner_user_id: string;
  task_id: number;
  source_type: "basecamp_thread" | "email_forward";
  external_id: string;
  source_url: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UserTaskActivity = {
  id: number;
  owner_user_id: string;
  task_id: number;
  activity_type:
    | "created"
    | "updated"
    | "status_changed"
    | "priority_changed"
    | "source_linked";
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UserTaskEmailToken = {
  owner_user_id: string;
  inbox_token: string;
  created_at: string;
  updated_at: string;
};

export type UserEmailMessageRow = {
  id: number;
  owner_user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  gmail_history_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[];
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  internal_date: string | null;
  label_ids: string[];
  is_read: boolean;
  is_starred: boolean;
  triage_status: "inbox" | "needs_action" | "archived" | "deleted";
  needs_action: boolean;
  is_high_priority: boolean;
  ai_priority: "high" | "medium" | "low" | null;
  ai_priority_reason: string | null;
  ai_assessed_at: string | null;
  task_id: number | null;
  raw_payload: Record<string, unknown>;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

export type UserEmailSenderRule = {
  sender: string;
  rule_type: "blacklist" | "always_high_priority";
  is_active: boolean;
};

export type UserTaskPerson = {
  id: number;
  owner_user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type UserTaskAssignee = {
  id: number;
  owner_user_id: string;
  task_id: number;
  person_id: number;
  created_at: string;
};

export type UserTaskLink = {
  id: number;
  owner_user_id: string;
  task_id: number;
  label: string;
  url: string;
  created_at: string;
  updated_at: string;
};

export type UserTaskAttachment = {
  id: number;
  owner_user_id: string;
  task_id: number;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

export type UserFocusDaily = {
  id: number;
  owner_user_id: string;
  focus_date: string;
  top_item_ids: string[];
  review_notes: string | null;
  review_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type UserFocusExcludedClient = {
  id: number;
  owner_user_id: string;
  client_id: number;
  created_at: string;
  updated_at: string;
};

export type ClientProjectStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived";

export type ClientProjectPhaseStatus =
  | "not_started"
  | "in_progress"
  | "done";

export type ClientProjectArtifactType =
  | "brainstorm"
  | "plan"
  | "weekly_status"
  | "note";

export type ClientProject = {
  id: number;
  owner_user_id: string;
  client_id: number | null;
  name: string;
  description: string | null;
  objective: string | null;
  status: ClientProjectStatus;
  target_start_date: string | null;
  target_end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientProjectLink = {
  id: number;
  owner_user_id: string;
  project_id: number;
  label: string;
  url: string;
  created_at: string;
  updated_at: string;
};

export type ClientProjectAttachment = {
  id: number;
  owner_user_id: string;
  project_id: number;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

export type ClientProjectPhase = {
  id: number;
  project_id: number;
  owner_user_id: string;
  title: string;
  sort_order: number;
  status: ClientProjectPhaseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientProjectArtifact = {
  id: number;
  project_id: number;
  owner_user_id: string;
  artifact_type: ClientProjectArtifactType;
  title: string;
  content_markdown: string;
  content_json: Record<string, unknown>;
  created_at: string;
};

export type ClientProjectPlanPhase = {
  title: string;
  tasks: Array<{
    title: string;
    priority?: UserTaskPriority;
    dueDate?: string | null;
    notes?: string | null;
  }>;
};

export type ClientProjectPlanJson = {
  phases: ClientProjectPlanPhase[];
  assumptions?: string[];
  risks?: string[];
};

export type ClientProjectWithMeta = ClientProject & {
  client: TaskClientOption | null;
  phases: ClientProjectPhase[];
  phaseDoneCount: number;
  phaseTotalCount: number;
  openTaskCount: number;
};

export type SalesProspectRun = {
  id: number;
  created_by: string;
  prospect_name: string | null;
  prospect_url: string;
  status: "running" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type SalesSeoFindings = {
  normalized_url: string;
  title: string | null;
  title_length: number;
  meta_description: string | null;
  meta_description_length: number;
  h1_count: number;
  canonical: string | null;
  robots_meta: string | null;
  has_json_ld_schema: boolean;
  schema_types: string[];
  has_sitemap_hint: boolean;
  has_robots_txt_hint: boolean;
  issues: Array<{
    id: string;
    severity: "critical" | "watch";
    title: string;
    description: string;
    recommendation: string;
  }>;
};

export type SalesLighthouseScores = {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
};

export type SalesLighthouseMetrics = {
  fcp: string | null;
  lcp: string | null;
  cls: string | null;
  tbt: string | null;
  speedIndex: string | null;
};

export type SalesLighthouseFinding = {
  id: string;
  title: string;
  description: string | null;
  display_value: string | null;
  score: number | null;
  severity: "critical" | "watch";
};

export type SalesExtractSnippet = {
  text: string;
  sourceUrl: string;
};

export type SalesSiteExtract = {
  scannedUrls: number;
  sourceUrls: string[];
  valueProps: SalesExtractSnippet[];
  reviews: SalesExtractSnippet[];
  services: string[];
  ctas: string[];
  contactPoints: string[];
  serviceAreas: string[];
  trustSignals: string[];
  reasonsToChoose: string[];
  missingSections: Array<"valueProps" | "reviews" | "services" | "trustSignals">;
  crawlDiagnostics: {
    attemptedUrls: number;
    skippedUrls: number;
    skippedByReason: Record<string, number>;
  };
};

export type SalesLogoAnalysis = {
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  brandPersonality: string;
  designCues: string[];
};

export type SalesPromptBrief = {
  targetKeyword: string | null;
  competitorUrl: string | null;
  valueProposition: string | null;
  clientTestimonial: string | null;
  crawlMode: "all_pages" | "core_pages";
  maxPages: number;
  promptStyle: "full" | "short";
  logoSource: "upload" | "url" | "none";
  competitorGaps: string[];
};

export type SalesProspectAudit = {
  id: number;
  run_id: number;
  seo_findings: SalesSeoFindings;
  lighthouse_scores: SalesLighthouseScores;
  lighthouse_metrics: SalesLighthouseMetrics;
  lighthouse_findings: SalesLighthouseFinding[];
  site_extract: SalesSiteExtract;
  extract_sources: string[];
  created_at: string;
  updated_at: string;
};

export type SalesProspectAiOutputs = {
  id: number;
  run_id: number;
  summary_json: StrategistSummaryResult;
  hostinger_prompt: string;
  followup_email_draft: string | null;
  logo_analysis: SalesLogoAnalysis;
  prompt_brief: SalesPromptBrief;
  created_at: string;
  updated_at: string;
};
