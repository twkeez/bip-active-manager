# Looker Studio Starter Dashboard

This project exposes report-ready data in BigQuery for Looker Studio.

## BigQuery Objects

Use dataset `${GCP_PROJECT_ID}.${BQ_DATASET}` and start with:

- `client_daily_metrics`
- `client_channel_snapshots`
- `client_alert_facts`
- `client_keyword_facts`

## Starter Pages

1. Executive Overview
   - scorecards: Ads clicks 30d, Search clicks 30d, Social reach 30d, GBP review count
   - table: client_name, strategist, urgency_score
2. Channel Performance
   - time series by `metric_date`
   - breakdown by channel from `client_channel_snapshots`
3. Alerts & Freshness
   - table from `client_alert_facts`
   - freshness status from `client_channel_snapshots`
4. Keyword Movement
   - table from `client_keyword_facts` filtered to `dropped_by_3_plus = true`

## Filters

- `metric_date`
- `client_id` / `client_name`
- `strategist`
- `severity` (alerts page)

## Validation

Before building in Looker Studio:

1. Run `POST /api/reporting/bigquery/connection`
2. Run `POST /api/reporting/bigquery/sync`
3. Run `POST /api/reporting/bigquery/validate`
4. Optionally run `GET /api/reporting/bigquery/health`

If these pass, connect Looker Studio to the dataset and build the pages above.
