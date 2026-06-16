create table if not exists public.client_seo_crawl_snapshots (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  base_url text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  max_urls integer not null default 50,
  crawled_urls integer not null default 0,
  run_status text not null default 'running' check (run_status in ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_seo_crawl_snapshots_client_created
  on public.client_seo_crawl_snapshots (client_id, created_at desc);

create table if not exists public.client_seo_crawl_issues (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  snapshot_id bigint not null references public.client_seo_crawl_snapshots(id) on delete cascade,
  rule_id text not null,
  severity text not null check (severity in ('critical', 'watch')),
  category text not null check (category in ('crawl', 'onpage', 'performance', 'indexability')),
  title text not null,
  description text,
  suggestion text,
  url text,
  location text,
  evidence text,
  occurrence_key text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_client_seo_crawl_issues_unique_occurrence
  on public.client_seo_crawl_issues (snapshot_id, occurrence_key);
create index if not exists idx_client_seo_crawl_issues_client_created
  on public.client_seo_crawl_issues (client_id, created_at desc);

create table if not exists public.client_gsc_snapshots (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  property_url text not null,
  start_date date not null,
  end_date date not null,
  run_status text not null default 'running' check (run_status in ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_gsc_snapshots_client_created
  on public.client_gsc_snapshots (client_id, created_at desc);

create table if not exists public.client_gsc_page_metrics (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  snapshot_id bigint not null references public.client_gsc_snapshots(id) on delete cascade,
  page_url text not null,
  clicks double precision not null default 0,
  impressions double precision not null default 0,
  ctr double precision not null default 0,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_gsc_page_metrics_snapshot
  on public.client_gsc_page_metrics (snapshot_id, impressions desc);

create table if not exists public.client_gsc_query_metrics (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  snapshot_id bigint not null references public.client_gsc_snapshots(id) on delete cascade,
  query text not null,
  clicks double precision not null default 0,
  impressions double precision not null default 0,
  ctr double precision not null default 0,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_gsc_query_metrics_snapshot
  on public.client_gsc_query_metrics (snapshot_id, impressions desc);

create table if not exists public.client_gsc_signals (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  snapshot_id bigint not null references public.client_gsc_snapshots(id) on delete cascade,
  signal_id text not null,
  severity text not null check (severity in ('critical', 'watch')),
  title text not null,
  description text,
  suggestion text,
  page_url text,
  query text,
  metric_value text,
  occurrence_key text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_client_gsc_signals_unique_occurrence
  on public.client_gsc_signals (snapshot_id, occurrence_key);
create index if not exists idx_client_gsc_signals_client_created
  on public.client_gsc_signals (client_id, created_at desc);

grant select on public.client_seo_crawl_snapshots to authenticated;
grant select on public.client_seo_crawl_issues to authenticated;
grant select on public.client_gsc_snapshots to authenticated;
grant select on public.client_gsc_page_metrics to authenticated;
grant select on public.client_gsc_query_metrics to authenticated;
grant select on public.client_gsc_signals to authenticated;

alter table public.client_seo_crawl_snapshots enable row level security;
alter table public.client_seo_crawl_issues enable row level security;
alter table public.client_gsc_snapshots enable row level security;
alter table public.client_gsc_page_metrics enable row level security;
alter table public.client_gsc_query_metrics enable row level security;
alter table public.client_gsc_signals enable row level security;

create policy "client_seo_crawl_snapshots_select_authenticated"
  on public.client_seo_crawl_snapshots
  for select
  to authenticated
  using (true);

create policy "client_seo_crawl_issues_select_authenticated"
  on public.client_seo_crawl_issues
  for select
  to authenticated
  using (true);

create policy "client_gsc_snapshots_select_authenticated"
  on public.client_gsc_snapshots
  for select
  to authenticated
  using (true);

create policy "client_gsc_page_metrics_select_authenticated"
  on public.client_gsc_page_metrics
  for select
  to authenticated
  using (true);

create policy "client_gsc_query_metrics_select_authenticated"
  on public.client_gsc_query_metrics
  for select
  to authenticated
  using (true);

create policy "client_gsc_signals_select_authenticated"
  on public.client_gsc_signals
  for select
  to authenticated
  using (true);
