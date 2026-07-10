-- Live organic (blue-link) SERP rank history for tracked keywords, checked at the
-- practice's location. One row per keyword per scan so we can show movement.
create table if not exists public.client_organic_rank_snapshots (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  keyword text not null,
  position integer,           -- null = not found in the top 100
  url text,
  top_domain text,            -- #1 organic result, for competitor context
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_client_organic_rank_snapshots_lookup
  on public.client_organic_rank_snapshots (owner_user_id, client_id, keyword, created_at desc);

grant select, insert, update, delete on public.client_organic_rank_snapshots to authenticated;
grant usage, select on sequence public.client_organic_rank_snapshots_id_seq to authenticated;

alter table public.client_organic_rank_snapshots enable row level security;

drop policy if exists "organic_rank_select_own" on public.client_organic_rank_snapshots;
create policy "organic_rank_select_own"
  on public.client_organic_rank_snapshots for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "organic_rank_insert_own" on public.client_organic_rank_snapshots;
create policy "organic_rank_insert_own"
  on public.client_organic_rank_snapshots for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "organic_rank_delete_own" on public.client_organic_rank_snapshots;
create policy "organic_rank_delete_own"
  on public.client_organic_rank_snapshots for delete to authenticated
  using (owner_user_id = auth.uid());
