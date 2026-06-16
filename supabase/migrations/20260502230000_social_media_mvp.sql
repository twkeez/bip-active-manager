create table if not exists public.client_social_connections (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram')),
  page_id text,
  ig_user_id text,
  account_username text,
  account_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, platform)
);

create index if not exists idx_client_social_connections_client
  on public.client_social_connections (client_id);

create table if not exists public.client_social_daily_snapshots (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  connection_id bigint references public.client_social_connections(id) on delete set null,
  platform text not null check (platform in ('facebook', 'instagram')),
  snapshot_date date not null,
  reach integer,
  impressions integer,
  engagement integer,
  profile_visits integer,
  follows integer,
  link_clicks integer,
  created_at timestamptz not null default now(),
  unique (client_id, platform, snapshot_date)
);

create index if not exists idx_client_social_daily_snapshots_client_date
  on public.client_social_daily_snapshots (client_id, snapshot_date desc);

create table if not exists public.client_social_post_snapshots (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  connection_id bigint references public.client_social_connections(id) on delete set null,
  platform text not null check (platform in ('facebook', 'instagram')),
  post_id text not null,
  media_type text,
  permalink text,
  caption text,
  published_at timestamptz,
  reach integer,
  impressions integer,
  engagement integer,
  comments integer,
  saves integer,
  shares integer,
  link_clicks integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, platform, post_id)
);

create index if not exists idx_client_social_post_snapshots_client_published
  on public.client_social_post_snapshots (client_id, published_at desc);

create table if not exists public.client_social_signals (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram', 'combined')),
  signal_id text not null,
  severity text not null check (severity in ('critical', 'watch')),
  title text not null,
  description text,
  suggestion text,
  metric_value text,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_social_signals_client_created
  on public.client_social_signals (client_id, created_at desc);

grant select on public.client_social_connections to authenticated;
grant select on public.client_social_daily_snapshots to authenticated;
grant select on public.client_social_post_snapshots to authenticated;
grant select on public.client_social_signals to authenticated;

alter table public.client_social_connections enable row level security;
alter table public.client_social_daily_snapshots enable row level security;
alter table public.client_social_post_snapshots enable row level security;
alter table public.client_social_signals enable row level security;

create policy "client_social_connections_select_authenticated"
  on public.client_social_connections
  for select
  to authenticated
  using (true);

create policy "client_social_daily_snapshots_select_authenticated"
  on public.client_social_daily_snapshots
  for select
  to authenticated
  using (true);

create policy "client_social_post_snapshots_select_authenticated"
  on public.client_social_post_snapshots
  for select
  to authenticated
  using (true);

create policy "client_social_signals_select_authenticated"
  on public.client_social_signals
  for select
  to authenticated
  using (true);
