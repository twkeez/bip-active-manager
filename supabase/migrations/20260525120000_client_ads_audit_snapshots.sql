create table if not exists public.client_ads_audit_snapshots (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  ads_snapshot_id bigint references public.client_ads_snapshots(id) on delete set null,
  start_date date not null,
  end_date date not null,
  report jsonb not null default '{}'::jsonb,
  narrative_markdown text,
  run_status text not null check (run_status in ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_ads_audit_snapshots_client_created
  on public.client_ads_audit_snapshots (client_id, created_at desc);

grant select on public.client_ads_audit_snapshots to authenticated;

alter table public.client_ads_audit_snapshots enable row level security;

create policy "client_ads_audit_snapshots_select_authenticated"
  on public.client_ads_audit_snapshots
  for select
  to authenticated
  using (true);
