-- Org-wide list of Basecamp projects excluded from marketing gap discovery.

create table if not exists public.basecamp_project_ignores (
  basecamp_project_id text primary key check (char_length(trim(basecamp_project_id)) > 0),
  project_name text not null check (char_length(trim(project_name)) > 0),
  reason text,
  ignored_at timestamptz not null default now(),
  ignored_by text
);

create index if not exists idx_basecamp_project_ignores_ignored_at
  on public.basecamp_project_ignores (ignored_at desc);

grant select, insert, update, delete on public.basecamp_project_ignores to authenticated;

alter table public.basecamp_project_ignores enable row level security;

drop policy if exists "basecamp_project_ignores_select_authenticated"
  on public.basecamp_project_ignores;
create policy "basecamp_project_ignores_select_authenticated"
  on public.basecamp_project_ignores
  for select
  to authenticated
  using (true);

drop policy if exists "basecamp_project_ignores_insert_authenticated"
  on public.basecamp_project_ignores;
create policy "basecamp_project_ignores_insert_authenticated"
  on public.basecamp_project_ignores
  for insert
  to authenticated
  with check (true);

drop policy if exists "basecamp_project_ignores_update_authenticated"
  on public.basecamp_project_ignores;
create policy "basecamp_project_ignores_update_authenticated"
  on public.basecamp_project_ignores
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "basecamp_project_ignores_delete_authenticated"
  on public.basecamp_project_ignores;
create policy "basecamp_project_ignores_delete_authenticated"
  on public.basecamp_project_ignores
  for delete
  to authenticated
  using (true);
