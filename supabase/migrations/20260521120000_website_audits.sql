create table if not exists public.website_audit_runs (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  input_url text not null check (char_length(trim(input_url)) > 0),
  normalized_url text,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed', 'partial')
  ),
  current_stage text,
  stage_status jsonb not null default '{}'::jsonb,
  report_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_website_audit_runs_owner_updated
  on public.website_audit_runs (owner_user_id, updated_at desc);

grant select, insert, update, delete on public.website_audit_runs to authenticated;

alter table public.website_audit_runs enable row level security;

create policy "website_audit_runs_select_own"
  on public.website_audit_runs
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "website_audit_runs_insert_own"
  on public.website_audit_runs
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "website_audit_runs_update_own"
  on public.website_audit_runs
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "website_audit_runs_delete_own"
  on public.website_audit_runs
  for delete to authenticated
  using (owner_user_id = auth.uid());
