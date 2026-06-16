create table if not exists public.client_projects (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  objective text,
  status text not null default 'draft' check (
    status in ('draft', 'active', 'paused', 'completed', 'archived')
  ),
  target_start_date date,
  target_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_projects_owner_status_updated
  on public.client_projects (owner_user_id, status, updated_at desc);

create index if not exists idx_client_projects_owner_client
  on public.client_projects (owner_user_id, client_id);

create table if not exists public.client_project_phases (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.client_projects(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  sort_order integer not null default 0,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'done')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_project_phases_project_sort
  on public.client_project_phases (project_id, sort_order, id);

create table if not exists public.client_project_artifacts (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.client_projects(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  artifact_type text not null check (
    artifact_type in ('brainstorm', 'plan', 'weekly_status', 'note')
  ),
  title text not null check (char_length(trim(title)) > 0),
  content_markdown text not null default '',
  content_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_project_artifacts_project_created
  on public.client_project_artifacts (project_id, created_at desc);

alter table public.user_tasks
  add column if not exists project_id bigint references public.client_projects(id) on delete set null;

create index if not exists idx_user_tasks_owner_project_status_due
  on public.user_tasks (owner_user_id, project_id, status, due_date);

grant select, insert, update, delete on public.client_projects to authenticated;
grant select, insert, update, delete on public.client_project_phases to authenticated;
grant select, insert, update, delete on public.client_project_artifacts to authenticated;

alter table public.client_projects enable row level security;
alter table public.client_project_phases enable row level security;
alter table public.client_project_artifacts enable row level security;

create policy "client_projects_select_own"
  on public.client_projects
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "client_projects_insert_own"
  on public.client_projects
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "client_projects_update_own"
  on public.client_projects
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "client_projects_delete_own"
  on public.client_projects
  for delete to authenticated
  using (owner_user_id = auth.uid());

create policy "client_project_phases_select_own"
  on public.client_project_phases
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "client_project_phases_insert_own"
  on public.client_project_phases
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.client_projects projects
      where projects.id = client_project_phases.project_id
        and projects.owner_user_id = auth.uid()
    )
  );

create policy "client_project_phases_update_own"
  on public.client_project_phases
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.client_projects projects
      where projects.id = client_project_phases.project_id
        and projects.owner_user_id = auth.uid()
    )
  );

create policy "client_project_phases_delete_own"
  on public.client_project_phases
  for delete to authenticated
  using (owner_user_id = auth.uid());

create policy "client_project_artifacts_select_own"
  on public.client_project_artifacts
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "client_project_artifacts_insert_own"
  on public.client_project_artifacts
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.client_projects projects
      where projects.id = client_project_artifacts.project_id
        and projects.owner_user_id = auth.uid()
    )
  );

create policy "client_project_artifacts_update_own"
  on public.client_project_artifacts
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "client_project_artifacts_delete_own"
  on public.client_project_artifacts
  for delete to authenticated
  using (owner_user_id = auth.uid());
