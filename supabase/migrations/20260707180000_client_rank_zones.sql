-- Geographic "zones" a client tracks local-pack rank in (cockpit SEO tab).
-- A zone is either a ZIP code (geocoded to coordinates) or a radius around the
-- practice. The latest scan is cached on the row so results show without a
-- fresh (paid) DataForSEO scan.
create table if not exists public.client_rank_zones (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  kind text not null check (kind in ('zip', 'radius')),
  zip text,
  radius_miles numeric(4, 1),
  label text not null,
  last_results jsonb,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_rank_zones_owner_client
  on public.client_rank_zones (owner_user_id, client_id, created_at desc);

grant select, insert, update, delete on public.client_rank_zones to authenticated;
grant usage, select on sequence public.client_rank_zones_id_seq to authenticated;

alter table public.client_rank_zones enable row level security;

drop policy if exists "client_rank_zones_select_own" on public.client_rank_zones;
create policy "client_rank_zones_select_own"
  on public.client_rank_zones for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "client_rank_zones_insert_own" on public.client_rank_zones;
create policy "client_rank_zones_insert_own"
  on public.client_rank_zones for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "client_rank_zones_update_own" on public.client_rank_zones;
create policy "client_rank_zones_update_own"
  on public.client_rank_zones for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "client_rank_zones_delete_own" on public.client_rank_zones;
create policy "client_rank_zones_delete_own"
  on public.client_rank_zones for delete to authenticated
  using (owner_user_id = auth.uid());
