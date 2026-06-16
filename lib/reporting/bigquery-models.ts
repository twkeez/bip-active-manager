import { runBigQueryQuery } from "@/lib/reporting/bigquery";

export async function ensureReportingModelV1(params: {
  datasetFqn: string;
}) {
  const { datasetFqn } = params;
  await runBigQueryQuery(`
    create table if not exists ${datasetFqn}.client_daily_metrics (
      metric_date date not null,
      client_id int64 not null,
      client_name string,
      strategist string,
      ads_clicks_30d float64,
      ads_cost_30d_usd float64,
      ads_ctr_30d float64,
      search_clicks_30d float64,
      search_impressions_30d float64,
      search_ctr_30d float64,
      social_reach_30d float64,
      social_engagement_30d float64,
      social_impressions_30d float64,
      gbp_rating float64,
      gbp_review_count int64,
      gbp_new_reviews_30d int64,
      seo_open_issues int64,
      seo_critical_issues int64,
      gsc_critical_signals int64,
      stale_sitemap_urls int64,
      urgency_score int64,
      source_updated_at timestamp,
      loaded_at timestamp not null
    )
    partition by metric_date
    cluster by client_id
  `);

  await runBigQueryQuery(`
    create table if not exists ${datasetFqn}.client_channel_snapshots (
      metric_date date not null,
      client_id int64 not null,
      channel string not null,
      status string,
      freshness_status string,
      updated_at timestamp,
      loaded_at timestamp not null
    )
    partition by metric_date
    cluster by client_id, channel
  `);

  await runBigQueryQuery(`
    create table if not exists ${datasetFqn}.client_alert_facts (
      metric_date date not null,
      client_id int64 not null,
      alert_id string not null,
      source string,
      severity string,
      title string,
      detected_at timestamp,
      loaded_at timestamp not null
    )
    partition by metric_date
    cluster by client_id, severity, source
  `);

  await runBigQueryQuery(`
    create table if not exists ${datasetFqn}.client_keyword_facts (
      metric_date date not null,
      client_id int64 not null,
      keyword string not null,
      tag string,
      priority int64,
      current_position float64,
      previous_position float64,
      position_delta float64,
      current_clicks float64,
      previous_clicks float64,
      dropped_by_3_plus bool,
      loaded_at timestamp not null
    )
    partition by metric_date
    cluster by client_id, keyword
  `);
}
