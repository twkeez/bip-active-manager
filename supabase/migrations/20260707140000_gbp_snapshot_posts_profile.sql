-- Add last post date and profile completeness fields to GBP snapshots.
alter table public.client_gbp_snapshots
  add column if not exists last_post_at timestamptz,
  add column if not exists profile_fields jsonb;
