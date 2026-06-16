create table if not exists public.user_focus_excluded_clients (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, client_id)
);

create index if not exists idx_user_focus_excluded_clients_owner
  on public.user_focus_excluded_clients (owner_user_id, client_id);

grant select, insert, update, delete on public.user_focus_excluded_clients to authenticated;

alter table public.user_focus_excluded_clients enable row level security;

create policy "user_focus_excluded_clients_select_own"
  on public.user_focus_excluded_clients
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "user_focus_excluded_clients_insert_own"
  on public.user_focus_excluded_clients
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "user_focus_excluded_clients_update_own"
  on public.user_focus_excluded_clients
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "user_focus_excluded_clients_delete_own"
  on public.user_focus_excluded_clients
  for delete to authenticated
  using (owner_user_id = auth.uid());
