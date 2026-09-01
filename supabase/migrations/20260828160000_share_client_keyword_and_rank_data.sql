-- Make client keyword targets, rank history and scan locations shared team data.
--
-- These three tables were scoped per user (owner_user_id, enforced in RLS), which
-- is wrong for data that describes a client rather than a person. Two strategists
-- opening the same client saw different keywords, and it failed silently — the
-- policy returned no rows rather than an error, so it read as "this client has no
-- keywords tracked".
--
-- The reach is wider than the SEO tab: client_keyword_targets feeds reporting,
-- SEO ops, local rank, the PPC campaign-plan drafter and the onboarding report.
-- A report built by one strategist could omit keywords another had chosen.
--
-- owner_user_id becomes created_by: provenance is worth keeping, scoping is not.
-- It goes nullable with ON DELETE SET NULL so removing a user no longer deletes
-- the client's keyword list along with them.

-- ── client_keyword_targets ────────────────────────────────────────────────────

-- Collapse rows two people both chose. Keeps the most recently updated version,
-- so whoever last had an opinion about priority/tag wins.
delete from public.client_keyword_targets a
using public.client_keyword_targets b
where a.client_id = b.client_id
  and lower(a.keyword) = lower(b.keyword)
  and (a.updated_at, a.id) < (b.updated_at, b.id);

alter table public.client_keyword_targets
  drop constraint if exists client_keyword_targets_owner_user_id_fkey;

alter table public.client_keyword_targets
  rename column owner_user_id to created_by;

alter table public.client_keyword_targets
  alter column created_by drop not null;

alter table public.client_keyword_targets
  add constraint client_keyword_targets_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

drop index if exists idx_client_keyword_targets_owner_client_keyword;
create unique index if not exists idx_client_keyword_targets_client_keyword
  on public.client_keyword_targets (client_id, lower(keyword));

drop policy if exists "client_keyword_targets_select_own" on public.client_keyword_targets;
drop policy if exists "client_keyword_targets_insert_own" on public.client_keyword_targets;
drop policy if exists "client_keyword_targets_update_own" on public.client_keyword_targets;
drop policy if exists "client_keyword_targets_delete_own" on public.client_keyword_targets;

create policy "client_keyword_targets_all_authenticated"
  on public.client_keyword_targets
  for all to authenticated
  using (true) with check (true);

-- ── client_organic_rank_snapshots ─────────────────────────────────────────────
-- Observations over time; nothing to collapse.

alter table public.client_organic_rank_snapshots
  drop constraint if exists client_organic_rank_snapshots_owner_user_id_fkey;

alter table public.client_organic_rank_snapshots
  rename column owner_user_id to created_by;

alter table public.client_organic_rank_snapshots
  alter column created_by drop not null;

alter table public.client_organic_rank_snapshots
  add constraint client_organic_rank_snapshots_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- Led with the scoping column, which is now meaningless as a leading key.
drop index if exists idx_client_organic_rank_snapshots_lookup;
create index if not exists idx_client_organic_rank_snapshots_lookup
  on public.client_organic_rank_snapshots (client_id, keyword, created_at desc);

drop policy if exists "organic_rank_select_own" on public.client_organic_rank_snapshots;
drop policy if exists "organic_rank_insert_own" on public.client_organic_rank_snapshots;
drop policy if exists "organic_rank_delete_own" on public.client_organic_rank_snapshots;

create policy "organic_rank_all_authenticated"
  on public.client_organic_rank_snapshots
  for all to authenticated
  using (true) with check (true);

-- ── client_organic_locations ──────────────────────────────────────────────────
-- The zips a rank scan runs from. Left per-user these would silently change the
-- results depending on who pressed the button.

delete from public.client_organic_locations a
using public.client_organic_locations b
where a.client_id = b.client_id
  and a.zip = b.zip
  and a.id < b.id;

alter table public.client_organic_locations
  drop constraint if exists client_organic_locations_owner_user_id_fkey;

alter table public.client_organic_locations
  rename column owner_user_id to created_by;

alter table public.client_organic_locations
  alter column created_by drop not null;

alter table public.client_organic_locations
  add constraint client_organic_locations_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.client_organic_locations
  drop constraint if exists client_organic_locations_owner_user_id_client_id_zip_key;

create unique index if not exists idx_client_organic_locations_client_zip
  on public.client_organic_locations (client_id, zip);

drop index if exists idx_client_organic_locations_lookup;
create index if not exists idx_client_organic_locations_lookup
  on public.client_organic_locations (client_id, created_at desc);

drop policy if exists "organic_locations_select_own" on public.client_organic_locations;
drop policy if exists "organic_locations_insert_own" on public.client_organic_locations;
drop policy if exists "organic_locations_update_own" on public.client_organic_locations;
drop policy if exists "organic_locations_delete_own" on public.client_organic_locations;

create policy "organic_locations_all_authenticated"
  on public.client_organic_locations
  for all to authenticated
  using (true) with check (true);
