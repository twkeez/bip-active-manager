create table if not exists public.client_keyword_targets (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  keyword text not null,
  tag text,
  priority integer not null default 50 check (priority between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_client_keyword_targets_owner_client_keyword
  on public.client_keyword_targets (owner_user_id, client_id, lower(keyword));

create index if not exists idx_client_keyword_targets_client_priority
  on public.client_keyword_targets (client_id, priority desc, created_at desc);

grant select, insert, update, delete on public.client_keyword_targets to authenticated;
grant usage, select on sequence public.client_keyword_targets_id_seq to authenticated;

alter table public.client_keyword_targets enable row level security;

drop policy if exists "client_keyword_targets_select_own" on public.client_keyword_targets;
create policy "client_keyword_targets_select_own"
  on public.client_keyword_targets
  for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "client_keyword_targets_insert_own" on public.client_keyword_targets;
create policy "client_keyword_targets_insert_own"
  on public.client_keyword_targets
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "client_keyword_targets_update_own" on public.client_keyword_targets;
create policy "client_keyword_targets_update_own"
  on public.client_keyword_targets
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "client_keyword_targets_delete_own" on public.client_keyword_targets;
create policy "client_keyword_targets_delete_own"
  on public.client_keyword_targets
  for delete
  to authenticated
  using (owner_user_id = auth.uid());
