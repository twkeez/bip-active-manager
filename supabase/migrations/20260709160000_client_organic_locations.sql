-- ZIP locations to check organic (blue-link) rank in, per client. Separate from
-- the local-pack zones. The practice location is always checked as a baseline.
create table if not exists public.client_organic_locations (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  zip text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, client_id, zip)
);

create index if not exists idx_client_organic_locations_lookup
  on public.client_organic_locations (owner_user_id, client_id, created_at);

grant select, insert, update, delete on public.client_organic_locations to authenticated;
grant usage, select on sequence public.client_organic_locations_id_seq to authenticated;

alter table public.client_organic_locations enable row level security;

drop policy if exists "organic_locations_select_own" on public.client_organic_locations;
create policy "organic_locations_select_own"
  on public.client_organic_locations for select to authenticated using (owner_user_id = auth.uid());
drop policy if exists "organic_locations_insert_own" on public.client_organic_locations;
create policy "organic_locations_insert_own"
  on public.client_organic_locations for insert to authenticated with check (owner_user_id = auth.uid());
drop policy if exists "organic_locations_delete_own" on public.client_organic_locations;
create policy "organic_locations_delete_own"
  on public.client_organic_locations for delete to authenticated using (owner_user_id = auth.uid());

-- Tag each organic rank snapshot with the location it was checked at.
alter table public.client_organic_rank_snapshots
  add column if not exists location_label text;
