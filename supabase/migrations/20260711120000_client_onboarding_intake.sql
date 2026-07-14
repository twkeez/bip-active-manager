-- Purpose-built onboarding intake, captured from the BIP pipeline form (parsed)
-- plus the strategist's confirmations. One row per client. Drives the wizard:
-- which services, when each starts, the website track, and what already exists.
create table if not exists public.client_onboarding_intake (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  form_type text,                 -- new_client | service_change | cancellation
  contract_signed boolean,
  -- Website track: has_site_keep | has_site_rebuild | splash_then_full |
  -- wait_for_launch | no_site
  web_status text,
  website_launch_date date,       -- the launch milestone (unlocks go-live steps)
  -- Per service: { seo: { tier, startTrigger, startDate, notes }, ppc: {...}, ... }
  -- tier: none|foundation|premium|premium_plus · startTrigger: start_now|at_launch|on_date
  service_start_plan jsonb not null default '{}'::jsonb,
  -- What already exists (drives create-vs-connect): { gbp, facebook, instagram, ga4 }
  channels_present jsonb not null default '{}'::jsonb,
  pipeline_notes text,            -- account notes + goals + sales notes for the strategist
  pipeline_raw jsonb,             -- full parsed extraction, for audit/debug
  source_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

create index if not exists idx_client_onboarding_intake_client
  on public.client_onboarding_intake (client_id);

grant select, insert, update, delete on public.client_onboarding_intake to authenticated;

alter table public.client_onboarding_intake enable row level security;

create policy "client_onboarding_intake_all_authenticated"
  on public.client_onboarding_intake
  for all
  to authenticated
  using (true)
  with check (true);
