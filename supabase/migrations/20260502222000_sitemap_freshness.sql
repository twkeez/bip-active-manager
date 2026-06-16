create table if not exists public.client_sitemap_snapshots (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  sitemap_url text not null,
  fetched_at timestamptz not null default now(),
  run_status text not null default 'completed' check (run_status in ('completed', 'failed')),
  error_message text,
  url_count integer not null default 0,
  with_lastmod_count integer not null default 0,
  latest_lastmod timestamptz,
  stale_90_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_sitemap_snapshots_client_created
  on public.client_sitemap_snapshots (client_id, created_at desc);

create table if not exists public.client_sitemap_urls (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  snapshot_id bigint not null references public.client_sitemap_snapshots(id) on delete cascade,
  loc text not null,
  lastmod timestamptz,
  http_last_modified timestamptz,
  effective_updated_at timestamptz,
  is_stale_90 boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_client_sitemap_urls_unique
  on public.client_sitemap_urls (snapshot_id, loc);
create index if not exists idx_client_sitemap_urls_client_created
  on public.client_sitemap_urls (client_id, created_at desc);

grant select on public.client_sitemap_snapshots to authenticated;
grant select on public.client_sitemap_urls to authenticated;

alter table public.client_sitemap_snapshots enable row level security;
alter table public.client_sitemap_urls enable row level security;

create policy "client_sitemap_snapshots_select_authenticated"
  on public.client_sitemap_snapshots
  for select
  to authenticated
  using (true);

create policy "client_sitemap_urls_select_authenticated"
  on public.client_sitemap_urls
  for select
  to authenticated
  using (true);
