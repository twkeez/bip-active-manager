create table if not exists public.client_ads_snapshots (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  customer_id text not null,
  start_date date not null,
  end_date date not null,
  run_status text not null check (run_status in ('running', 'completed', 'failed')),
  error_message text,
  totals jsonb not null default '{}'::jsonb,
  campaigns jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_ads_snapshots_client_created
  on public.client_ads_snapshots (client_id, created_at desc);

create table if not exists public.client_ads_signals (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  snapshot_id bigint not null references public.client_ads_snapshots(id) on delete cascade,
  signal_id text not null,
  severity text not null check (severity in ('critical', 'watch')),
  title text not null,
  description text,
  suggestion text,
  metric_value text,
  occurrence_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_ads_signals_client_created
  on public.client_ads_signals (client_id, created_at desc);

grant select on public.client_ads_snapshots to authenticated;
grant select on public.client_ads_signals to authenticated;

alter table public.client_ads_snapshots enable row level security;
alter table public.client_ads_signals enable row level security;

create policy "client_ads_snapshots_select_authenticated"
  on public.client_ads_snapshots
  for select
  to authenticated
  using (true);

create policy "client_ads_signals_select_authenticated"
  on public.client_ads_signals
  for select
  to authenticated
  using (true);
