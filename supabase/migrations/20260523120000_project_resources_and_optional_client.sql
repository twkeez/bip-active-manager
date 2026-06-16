-- Optional client on projects (internal / non-client work)
alter table public.client_projects
  alter column client_id drop not null;

create table if not exists public.client_project_links (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id bigint not null references public.client_projects(id) on delete cascade,
  label text not null check (char_length(trim(label)) > 0),
  url text not null check (char_length(trim(url)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_project_links_project_created
  on public.client_project_links (project_id, created_at desc);

create table if not exists public.client_project_attachments (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id bigint not null references public.client_projects(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_project_attachments_project_created
  on public.client_project_attachments (project_id, created_at desc);

grant select, insert, update, delete on public.client_project_links to authenticated;
grant select, insert, update, delete on public.client_project_attachments to authenticated;

alter table public.client_project_links enable row level security;
alter table public.client_project_attachments enable row level security;

create policy "client_project_links_select_own"
  on public.client_project_links
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "client_project_links_insert_own"
  on public.client_project_links
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from public.client_projects p
      where p.id = project_id and p.owner_user_id = auth.uid()
    )
  );

create policy "client_project_links_update_own"
  on public.client_project_links
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "client_project_links_delete_own"
  on public.client_project_links
  for delete to authenticated
  using (owner_user_id = auth.uid());

create policy "client_project_attachments_select_own"
  on public.client_project_attachments
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "client_project_attachments_insert_own"
  on public.client_project_attachments
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1 from public.client_projects p
      where p.id = project_id and p.owner_user_id = auth.uid()
    )
  );

create policy "client_project_attachments_update_own"
  on public.client_project_attachments
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "client_project_attachments_delete_own"
  on public.client_project_attachments
  for delete to authenticated
  using (owner_user_id = auth.uid());
