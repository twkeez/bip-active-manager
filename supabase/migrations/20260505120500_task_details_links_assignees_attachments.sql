alter table public.user_tasks
  add column if not exists description text;

create table if not exists public.user_task_people (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_user_task_people_owner_lower_name
  on public.user_task_people (owner_user_id, lower(name));

create table if not exists public.user_task_assignees (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  task_id bigint not null references public.user_tasks(id) on delete cascade,
  person_id bigint not null references public.user_task_people(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, person_id)
);

create index if not exists idx_user_task_assignees_owner_task
  on public.user_task_assignees (owner_user_id, task_id);

create table if not exists public.user_task_links (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  task_id bigint not null references public.user_tasks(id) on delete cascade,
  label text not null check (char_length(trim(label)) > 0),
  url text not null check (char_length(trim(url)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_task_links_owner_task
  on public.user_task_links (owner_user_id, task_id, created_at desc);

create table if not exists public.user_task_attachments (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  task_id bigint not null references public.user_tasks(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_task_attachments_owner_task
  on public.user_task_attachments (owner_user_id, task_id, created_at desc);

grant select, insert, update, delete on public.user_task_people to authenticated;
grant select, insert, update, delete on public.user_task_assignees to authenticated;
grant select, insert, update, delete on public.user_task_links to authenticated;
grant select, insert, update, delete on public.user_task_attachments to authenticated;

alter table public.user_task_people enable row level security;
alter table public.user_task_assignees enable row level security;
alter table public.user_task_links enable row level security;
alter table public.user_task_attachments enable row level security;

create policy "user_task_people_select_own"
  on public.user_task_people
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_people_insert_own"
  on public.user_task_people
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "user_task_people_update_own"
  on public.user_task_people
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "user_task_people_delete_own"
  on public.user_task_people
  for delete to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_assignees_select_own"
  on public.user_task_assignees
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_assignees_insert_own"
  on public.user_task_assignees
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.user_tasks tasks
      where tasks.id = user_task_assignees.task_id
        and tasks.owner_user_id = auth.uid()
    )
    and exists (
      select 1
      from public.user_task_people people
      where people.id = user_task_assignees.person_id
        and people.owner_user_id = auth.uid()
    )
  );

create policy "user_task_assignees_delete_own"
  on public.user_task_assignees
  for delete to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_links_select_own"
  on public.user_task_links
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_links_insert_own"
  on public.user_task_links
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.user_tasks tasks
      where tasks.id = user_task_links.task_id
        and tasks.owner_user_id = auth.uid()
    )
  );

create policy "user_task_links_update_own"
  on public.user_task_links
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "user_task_links_delete_own"
  on public.user_task_links
  for delete to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_attachments_select_own"
  on public.user_task_attachments
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_attachments_insert_own"
  on public.user_task_attachments
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.user_tasks tasks
      where tasks.id = user_task_attachments.task_id
        and tasks.owner_user_id = auth.uid()
    )
  );

create policy "user_task_attachments_update_own"
  on public.user_task_attachments
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "user_task_attachments_delete_own"
  on public.user_task_attachments
  for delete to authenticated
  using (owner_user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('task-documents', 'task-documents', false)
on conflict (id) do nothing;

create policy "task_documents_select_own"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "task_documents_insert_own"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "task_documents_update_own"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'task-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'task-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "task_documents_delete_own"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
