-- Recurring client-facing SEO audits (template-based deliverable).
--
-- Two tables:
--   client_seo_audit_schedules  one cadence row per enrolled client; the
--                               denormalized next_due_at drives the dashboard
--                               "due" surface (same pattern as sitemap freshness).
--   client_seo_audits           one filled-template instance per audit period,
--                               optionally linked to the website_audit_runs row
--                               whose report_json fed the auto-filled ratings.

create table if not exists public.client_seo_audit_schedules (
  id bigint generated always as identity primary key,
  client_id bigint not null unique references public.clients(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  cadence_months integer not null default 6 check (cadence_months in (3, 6)),
  last_completed_at timestamptz,
  next_due_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_seo_audit_schedules_due
  on public.client_seo_audit_schedules (next_due_at);

create table if not exists public.client_seo_audits (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  audit_run_id bigint references public.website_audit_runs(id) on delete set null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'draft', 'completed')),
  audit_date date not null default current_date,
  prepared_by text,
  package_tier text,
  template_json jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_seo_audits_client_created
  on public.client_seo_audits (client_id, created_at desc);

grant select, insert, update, delete on public.client_seo_audit_schedules to authenticated;
grant select, insert, update, delete on public.client_seo_audits to authenticated;

alter table public.client_seo_audit_schedules enable row level security;
alter table public.client_seo_audits enable row level security;

-- Owner-scoped access (mirrors the gmail/task tables: a user sees only their own
-- rows). Clients are shared across the team, but audit work belongs to its owner.
create policy "client_seo_audit_schedules_select_own"
  on public.client_seo_audit_schedules for select to authenticated
  using (owner_user_id = auth.uid());
create policy "client_seo_audit_schedules_insert_own"
  on public.client_seo_audit_schedules for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "client_seo_audit_schedules_update_own"
  on public.client_seo_audit_schedules for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
create policy "client_seo_audit_schedules_delete_own"
  on public.client_seo_audit_schedules for delete to authenticated
  using (owner_user_id = auth.uid());

create policy "client_seo_audits_select_own"
  on public.client_seo_audits for select to authenticated
  using (owner_user_id = auth.uid());
create policy "client_seo_audits_insert_own"
  on public.client_seo_audits for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy "client_seo_audits_update_own"
  on public.client_seo_audits for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
create policy "client_seo_audits_delete_own"
  on public.client_seo_audits for delete to authenticated
  using (owner_user_id = auth.uid());
