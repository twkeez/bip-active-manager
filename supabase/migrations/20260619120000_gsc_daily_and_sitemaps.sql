-- Daily GSC trend data (clicks/impressions per day per snapshot)
create table if not exists client_gsc_daily_metrics (
  id bigserial primary key,
  client_id integer not null references clients(id) on delete cascade,
  snapshot_id bigint not null,
  metric_date date not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(8,6) not null default 0,
  position numeric(8,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_gsc_daily_client_date
  on client_gsc_daily_metrics (client_id, metric_date desc);

alter table client_gsc_daily_metrics enable row level security;
create policy "auth users can manage gsc daily metrics"
  on client_gsc_daily_metrics for all to authenticated using (true) with check (true);

-- Sitemap snapshots per client
create table if not exists client_gsc_sitemaps (
  id bigserial primary key,
  client_id integer not null references clients(id) on delete cascade,
  snapshot_id bigint not null,
  sitemap_url text not null,
  last_submitted timestamptz,
  last_downloaded timestamptz,
  is_pending boolean not null default false,
  is_sitemaps_index boolean not null default false,
  errors integer not null default 0,
  warnings integer not null default 0,
  urls_submitted integer not null default 0,
  urls_indexed integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_gsc_sitemaps_client
  on client_gsc_sitemaps (client_id, snapshot_id);

alter table client_gsc_sitemaps enable row level security;
create policy "auth users can manage gsc sitemaps"
  on client_gsc_sitemaps for all to authenticated using (true) with check (true);
