-- Client onboarding workflow: status on clients + template + per-client checklist items.

alter table public.clients
  add column if not exists onboarding_status text
    check (onboarding_status in ('active', 'complete')),
  add column if not exists onboarding_started_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_target_date date;

-- Grandfather existing clients as complete (queue starts empty).
update public.clients
set onboarding_status = 'complete'
where onboarding_status is null;

create index if not exists idx_clients_onboarding_status
  on public.clients (onboarding_status, onboarding_started_at desc nulls last);

create table if not exists public.client_onboarding_templates (
  id bigint generated always as identity primary key,
  item_key text not null unique check (char_length(trim(item_key)) > 0),
  label text not null check (char_length(trim(label)) > 0),
  category text not null check (category in ('intake', 'connections', 'communication', 'launch')),
  severity text not null default 'required'
    check (severity in ('required', 'recommended')),
  verification text not null default 'manual'
    check (char_length(trim(verification)) > 0),
  sort_order integer not null default 0,
  required_for_graduation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_onboarding_templates_sort
  on public.client_onboarding_templates (sort_order, id);

create table if not exists public.client_onboarding_items (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  item_key text not null check (char_length(trim(item_key)) > 0),
  label text not null check (char_length(trim(label)) > 0),
  category text not null check (category in ('intake', 'connections', 'communication', 'launch')),
  severity text not null default 'required'
    check (severity in ('required', 'recommended')),
  verification text not null default 'manual'
    check (char_length(trim(verification)) > 0),
  sort_order integer not null default 0,
  required_for_graduation boolean not null default true,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, item_key)
);

create index if not exists idx_client_onboarding_items_client_sort
  on public.client_onboarding_items (client_id, sort_order, id);

grant select on public.client_onboarding_templates to authenticated;
grant select, insert, update, delete on public.client_onboarding_items to authenticated;

alter table public.client_onboarding_templates enable row level security;
alter table public.client_onboarding_items enable row level security;

create policy "client_onboarding_templates_select_authenticated"
  on public.client_onboarding_templates
  for select
  to authenticated
  using (true);

create policy "client_onboarding_items_select_authenticated"
  on public.client_onboarding_items
  for select
  to authenticated
  using (true);

create policy "client_onboarding_items_insert_authenticated"
  on public.client_onboarding_items
  for insert
  to authenticated
  with check (true);

create policy "client_onboarding_items_update_authenticated"
  on public.client_onboarding_items
  for update
  to authenticated
  using (true)
  with check (true);

create policy "client_onboarding_items_delete_authenticated"
  on public.client_onboarding_items
  for delete
  to authenticated
  using (true);

insert into public.client_onboarding_templates
  (item_key, label, category, severity, verification, sort_order, required_for_graduation)
values
  ('intake_account_profile', 'Account name, strategist, tier, and package hours', 'intake', 'required', 'manual:intake_profile', 10, true),
  ('intake_services', 'Active services set (Blog / SMM / SEO / PPC / ORM)', 'intake', 'required', 'manual:intake_services', 20, true),
  ('intake_record_created', 'Client record created in tool', 'intake', 'required', 'manual:record_created', 30, true),
  ('conn_website', 'Website URL', 'connections', 'required', 'setup:website', 100, true),
  ('conn_basecamp', 'Basecamp project ID', 'connections', 'required', 'setup:basecamp', 110, true),
  ('conn_search_console', 'Search Console URL', 'connections', 'required', 'setup:search_console', 120, true),
  ('conn_google_ads', 'Google Ads customer ID', 'connections', 'required', 'setup:google_ads', 130, true),
  ('conn_social', 'Social connection', 'connections', 'required', 'setup:social_connection', 140, true),
  ('conn_ga4', 'GA4 property ID', 'connections', 'recommended', 'setup:ga4_property_id', 150, false),
  ('conn_place_id', 'Google Place ID', 'connections', 'recommended', 'setup:google_place_id', 160, false),
  ('conn_harvest', 'Harvest project and client IDs', 'connections', 'recommended', 'setup:harvest', 170, false),
  ('comms_welcome', 'Welcome / kickoff message posted in Basecamp', 'communication', 'required', 'manual:comms_welcome', 200, true),
  ('comms_client_reply', 'Client responded to kickoff', 'communication', 'required', 'comms:client_reply', 210, true),
  ('comms_weekly_cadence', 'Weekly client touchpoint (within 7 days)', 'communication', 'required', 'comms:weekly_cadence', 220, true),
  ('comms_expectations', 'Strategist intro / expectations documented', 'communication', 'required', 'manual:comms_expectations', 230, true),
  ('launch_baseline_seo', 'Baseline SEO crawl or Lighthouse run', 'launch', 'recommended', 'snapshot:seo_baseline', 300, false),
  ('launch_keywords', 'Keyword targets added', 'launch', 'recommended', 'snapshot:keyword_targets', 310, false),
  ('launch_reporting_prefs', 'Reporting metric preferences saved', 'launch', 'recommended', 'snapshot:reporting_prefs', 320, false)
on conflict (item_key) do nothing;
