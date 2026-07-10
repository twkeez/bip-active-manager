-- Meta (Facebook/Instagram) paid-ads reporting. Mirrors client_ads_snapshots
-- (Google Ads). Writes come from the admin/service-role sync; authenticated
-- users get read-only access (RLS select true), matching the Google Ads table.

-- Manual override for the auto-matcher: the numeric Meta ad-account id (digits
-- only; the sync prepends "act_"). Left null for clients matched automatically.
alter table public.clients
  add column if not exists meta_ad_account_id text;

create table if not exists public.client_meta_ads_snapshots (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  ad_account_id text not null,
  ad_account_name text,
  start_date date not null,
  end_date date not null,
  run_status text not null check (run_status in ('running', 'completed', 'failed')),
  error_message text,
  totals jsonb not null default '{}'::jsonb,
  campaigns jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_meta_ads_snapshots_client_created
  on public.client_meta_ads_snapshots (client_id, created_at desc);

grant select on public.client_meta_ads_snapshots to authenticated;

alter table public.client_meta_ads_snapshots enable row level security;

create policy "client_meta_ads_snapshots_select_authenticated"
  on public.client_meta_ads_snapshots
  for select
  to authenticated
  using (true);
