create table if not exists public.client_reporting_metric_preferences (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  metric_id text not null,
  is_enabled boolean not null default true,
  display_order integer not null default 100 check (display_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_client_reporting_metric_prefs_owner_client_metric
  on public.client_reporting_metric_preferences (owner_user_id, client_id, metric_id);

create index if not exists idx_client_reporting_metric_prefs_order
  on public.client_reporting_metric_preferences (owner_user_id, client_id, display_order asc, created_at asc);

grant select, insert, update, delete on public.client_reporting_metric_preferences to authenticated;
grant usage, select on sequence public.client_reporting_metric_preferences_id_seq to authenticated;

alter table public.client_reporting_metric_preferences enable row level security;

drop policy if exists "client_reporting_metric_prefs_select_own" on public.client_reporting_metric_preferences;
create policy "client_reporting_metric_prefs_select_own"
  on public.client_reporting_metric_preferences
  for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "client_reporting_metric_prefs_insert_own" on public.client_reporting_metric_preferences;
create policy "client_reporting_metric_prefs_insert_own"
  on public.client_reporting_metric_preferences
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "client_reporting_metric_prefs_update_own" on public.client_reporting_metric_preferences;
create policy "client_reporting_metric_prefs_update_own"
  on public.client_reporting_metric_preferences
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "client_reporting_metric_prefs_delete_own" on public.client_reporting_metric_preferences;
create policy "client_reporting_metric_prefs_delete_own"
  on public.client_reporting_metric_preferences
  for delete
  to authenticated
  using (owner_user_id = auth.uid());
