-- Structured Google Ads AI assessments per client. Produced by Claude from the
-- existing audit data (see lib/ads/assessment.ts) and rendered in the client Ads tab.
-- Accessed only via the service-role admin client, mirroring client_ads_audit_snapshots.
create table if not exists public.client_ads_assessments (
  id bigserial primary key,
  client_id bigint not null references public.clients (id) on delete cascade,
  ads_snapshot_id bigint,
  audit_snapshot_id bigint,
  start_date date,
  end_date date,
  assessment jsonb not null default '{}'::jsonb,
  run_status text not null default 'completed' check (run_status in ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_ads_assessments_client
  on public.client_ads_assessments (client_id, created_at desc);

-- Locked down: only the service-role key (used by the API routes) may read/write.
alter table public.client_ads_assessments enable row level security;
