-- De-duplicated, period-level social metrics (currently Instagram reach) that
-- can't be derived by summing the daily snapshots. One row per client+platform,
-- refreshed on each social sync.
create table if not exists public.client_social_period_metrics (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram')),
  reach integer,
  window_days integer not null default 30,
  captured_at timestamptz not null default now(),
  unique (client_id, platform)
);

create index if not exists idx_client_social_period_metrics_client
  on public.client_social_period_metrics (client_id);

grant select, insert, update, delete on public.client_social_period_metrics to authenticated;
grant usage, select on sequence public.client_social_period_metrics_id_seq to authenticated;

alter table public.client_social_period_metrics enable row level security;

-- Mirrors client_social_daily_snapshots: any authenticated user can read; writes
-- happen via the service-role sync. (Adjust if you scope social by owner later.)
drop policy if exists "client_social_period_metrics_select" on public.client_social_period_metrics;
create policy "client_social_period_metrics_select"
  on public.client_social_period_metrics for select to authenticated using (true);
