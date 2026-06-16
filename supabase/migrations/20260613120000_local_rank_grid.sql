create table if not exists public.local_rank_grid_runs (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'complete', 'failed')),
  grid_size integer not null default 5 check (grid_size = 5),
  radius_miles numeric(6, 2) not null default 5,
  center_lat double precision not null,
  center_lng double precision not null,
  business_name text not null,
  matched_place_id text,
  keywords text[] not null check (cardinality(keywords) between 1 and 3),
  api_calls_planned integer not null default 0,
  api_calls_completed integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_local_rank_grid_runs_client_created
  on public.local_rank_grid_runs (client_id, created_at desc);

create index if not exists idx_local_rank_grid_runs_owner
  on public.local_rank_grid_runs (owner_user_id, created_at desc);

create table if not exists public.local_rank_grid_cells (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.local_rank_grid_runs(id) on delete cascade,
  keyword text not null,
  row_idx integer not null check (row_idx >= 0),
  col_idx integer not null check (col_idx >= 0),
  lat double precision not null,
  lng double precision not null,
  label text not null,
  rank integer,
  in_local_pack boolean not null default false,
  matched_listing_title text,
  matched_listing_domain text,
  top_competitor_title text,
  unique (run_id, keyword, row_idx, col_idx)
);

create index if not exists idx_local_rank_grid_cells_run
  on public.local_rank_grid_cells (run_id);

grant select, insert, update, delete on public.local_rank_grid_runs to authenticated;
grant select, insert, update, delete on public.local_rank_grid_cells to authenticated;
grant usage, select on sequence public.local_rank_grid_runs_id_seq to authenticated;
grant usage, select on sequence public.local_rank_grid_cells_id_seq to authenticated;

alter table public.local_rank_grid_runs enable row level security;
alter table public.local_rank_grid_cells enable row level security;

drop policy if exists "local_rank_grid_runs_select_own" on public.local_rank_grid_runs;
create policy "local_rank_grid_runs_select_own"
  on public.local_rank_grid_runs for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "local_rank_grid_runs_insert_own" on public.local_rank_grid_runs;
create policy "local_rank_grid_runs_insert_own"
  on public.local_rank_grid_runs for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "local_rank_grid_runs_update_own" on public.local_rank_grid_runs;
create policy "local_rank_grid_runs_update_own"
  on public.local_rank_grid_runs for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "local_rank_grid_runs_delete_own" on public.local_rank_grid_runs;
create policy "local_rank_grid_runs_delete_own"
  on public.local_rank_grid_runs for delete to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "local_rank_grid_cells_select_own" on public.local_rank_grid_cells;
create policy "local_rank_grid_cells_select_own"
  on public.local_rank_grid_cells for select to authenticated
  using (
    exists (
      select 1 from public.local_rank_grid_runs r
      where r.id = run_id and r.owner_user_id = auth.uid()
    )
  );

drop policy if exists "local_rank_grid_cells_insert_own" on public.local_rank_grid_cells;
create policy "local_rank_grid_cells_insert_own"
  on public.local_rank_grid_cells for insert to authenticated
  with check (
    exists (
      select 1 from public.local_rank_grid_runs r
      where r.id = run_id and r.owner_user_id = auth.uid()
    )
  );

drop policy if exists "local_rank_grid_cells_delete_own" on public.local_rank_grid_cells;
create policy "local_rank_grid_cells_delete_own"
  on public.local_rank_grid_cells for delete to authenticated
  using (
    exists (
      select 1 from public.local_rank_grid_runs r
      where r.id = run_id and r.owner_user_id = auth.uid()
    )
  );
