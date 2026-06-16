alter table public.client_ads_snapshots
  add column if not exists auction_insights jsonb not null default '[]'::jsonb,
  add column if not exists keyword_quality jsonb not null default '[]'::jsonb;
