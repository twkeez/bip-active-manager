create table if not exists public.user_tasks (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  notes text,
  status text not null default 'inbox' check (status in ('inbox', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  source_type text not null default 'manual' check (source_type in ('manual', 'basecamp', 'email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_tasks_owner_status_priority_due
  on public.user_tasks (owner_user_id, status, priority, due_date, updated_at desc);

create index if not exists idx_user_tasks_owner_updated
  on public.user_tasks (owner_user_id, updated_at desc);

create table if not exists public.user_task_sources (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  task_id bigint not null references public.user_tasks(id) on delete cascade,
  source_type text not null check (source_type in ('basecamp_thread', 'email_forward')),
  external_id text not null,
  source_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, source_type, external_id),
  unique (task_id, source_type)
);

create index if not exists idx_user_task_sources_owner
  on public.user_task_sources (owner_user_id, source_type, created_at desc);

create table if not exists public.user_task_activity (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  task_id bigint not null references public.user_tasks(id) on delete cascade,
  activity_type text not null check (
    activity_type in ('created', 'updated', 'status_changed', 'priority_changed', 'source_linked')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_task_activity_owner_task
  on public.user_task_activity (owner_user_id, task_id, created_at desc);

create table if not exists public.user_task_email_tokens (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  inbox_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.user_tasks to authenticated;
grant select, insert, update, delete on public.user_task_sources to authenticated;
grant select, insert on public.user_task_activity to authenticated;
grant select, insert, update on public.user_task_email_tokens to authenticated;

alter table public.user_tasks enable row level security;
alter table public.user_task_sources enable row level security;
alter table public.user_task_activity enable row level security;
alter table public.user_task_email_tokens enable row level security;

create policy "user_tasks_select_own"
  on public.user_tasks
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "user_tasks_insert_own"
  on public.user_tasks
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "user_tasks_update_own"
  on public.user_tasks
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "user_tasks_delete_own"
  on public.user_tasks
  for delete
  to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_sources_select_own"
  on public.user_task_sources
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_sources_insert_own"
  on public.user_task_sources
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.user_tasks tasks
      where tasks.id = user_task_sources.task_id
        and tasks.owner_user_id = auth.uid()
    )
  );

create policy "user_task_sources_update_own"
  on public.user_task_sources
  for update
  to authenticated
  using (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.user_tasks tasks
      where tasks.id = user_task_sources.task_id
        and tasks.owner_user_id = auth.uid()
    )
  )
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.user_tasks tasks
      where tasks.id = user_task_sources.task_id
        and tasks.owner_user_id = auth.uid()
    )
  );

create policy "user_task_sources_delete_own"
  on public.user_task_sources
  for delete
  to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_activity_select_own"
  on public.user_task_activity
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_activity_insert_own"
  on public.user_task_activity
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.user_tasks tasks
      where tasks.id = user_task_activity.task_id
        and tasks.owner_user_id = auth.uid()
    )
  );

create policy "user_task_email_tokens_select_own"
  on public.user_task_email_tokens
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_email_tokens_insert_own"
  on public.user_task_email_tokens
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "user_task_email_tokens_update_own"
  on public.user_task_email_tokens
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
