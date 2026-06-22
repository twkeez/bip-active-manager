-- Additional GA4 breakdowns for the expanded reporting:
--   conversions by key event, geography, device, source/medium,
--   new vs returning, sessions trend (by date), and landing pages.
-- New scalar engagement-quality metrics live inside the existing `totals` jsonb,
-- so no column is needed for those. Existing rows backfill to '[]'.

alter table client_ga4_snapshots
  add column if not exists conversions_by_event    jsonb not null default '[]',
  add column if not exists geo_breakdown           jsonb not null default '[]',
  add column if not exists device_breakdown        jsonb not null default '[]',
  add column if not exists source_medium_breakdown jsonb not null default '[]',
  add column if not exists new_vs_returning        jsonb not null default '[]',
  add column if not exists sessions_trend          jsonb not null default '[]',
  add column if not exists landing_pages           jsonb not null default '[]';
