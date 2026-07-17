-- Per-call detail from the Google Ads call_view resource, stored alongside the
-- rolling 30-day snapshot (like campaigns / auction_insights). One array of
-- calls per snapshot run; the internal Ad Calls view reads the latest per client.
alter table public.client_ads_snapshots
  add column if not exists calls jsonb not null default '[]'::jsonb;
