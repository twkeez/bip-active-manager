-- Persist the full local pack (all listings) captured at each grid point, so we
-- can show which competitors outrank the practice and in how many areas.
alter table public.local_rank_grid_cells
  add column if not exists pack_listings jsonb;
