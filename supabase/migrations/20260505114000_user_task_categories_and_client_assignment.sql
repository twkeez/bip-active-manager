create table if not exists public.user_task_categories (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_user_task_categories_owner_lower_name
  on public.user_task_categories (owner_user_id, lower(name));

create index if not exists idx_user_task_categories_owner_created
  on public.user_task_categories (owner_user_id, created_at desc);

alter table public.user_task_categories enable row level security;
grant select, insert, update, delete on public.user_task_categories to authenticated;

create policy "user_task_categories_select_own"
  on public.user_task_categories
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "user_task_categories_insert_own"
  on public.user_task_categories
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "user_task_categories_update_own"
  on public.user_task_categories
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "user_task_categories_delete_own"
  on public.user_task_categories
  for delete
  to authenticated
  using (owner_user_id = auth.uid());

alter table public.user_tasks
  add column if not exists category_id bigint references public.user_task_categories(id) on delete set null,
  add column if not exists client_id bigint references public.clients(id) on delete set null;

create index if not exists idx_user_tasks_owner_category
  on public.user_tasks (owner_user_id, category_id, updated_at desc);

create index if not exists idx_user_tasks_owner_client
  on public.user_tasks (owner_user_id, client_id, updated_at desc);
