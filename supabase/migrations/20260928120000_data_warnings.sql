-- Warnings that some data may be incomplete (Tom, 2026-09-28: "I need to know
-- if data is questionable").
--
-- The database returns at most 1000 rows per request and says nothing when it
-- stops. Every read in the app passes through a check: a response of exactly
-- 1000 rows was almost certainly cut short, so it is recorded here, once per
-- kind of query (problem_key), with how often and when it was last seen. The
-- hourly watchdog emails Tom about new ones, the app shows a banner while any
-- are open, and client reports and briefings refuse to export over one.

create table if not exists public.data_warnings (
  id bigint generated always as identity primary key,
  problem_key text not null unique,
  kind text not null default 'row_cap',
  table_name text,
  detail text not null,
  rows_returned integer,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_data_warnings_open on public.data_warnings (resolved_at, last_seen_at desc);

alter table public.data_warnings enable row level security;
grant select on public.data_warnings to authenticated;

drop policy if exists "data_warnings_select" on public.data_warnings;
create policy "data_warnings_select"
  on public.data_warnings for select to authenticated using (true);
-- Writes go through the service role (server) or /api/data-warnings (browser).

-- The newest snapshot row per client, computed in the database.
--
-- The app used to fetch the newest 500 rows of a snapshot table across ALL
-- clients and keep the latest per client. Once more than 500 rows sat between
-- now and a client's last snapshot (about a week of nightly ads syncs), that
-- client silently vanished from the client list, Global Ads Optimization, PPC
-- Defense, Conversion Integrity and Ad Calls, instead of showing as stale.
-- DISTINCT ON returns exactly one row per client (a few hundred at most), so
-- no cap can cut it short. Only listed tables are allowed, and RLS applies
-- (security invoker).
create or replace function public.latest_snapshot_per_client(
  p_table text,
  p_client_id bigint default null,
  -- Only rows with run_status = 'completed' (for tables that have run_status).
  p_completed_only boolean default false
)
returns setof jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_table not in (
    'client_ads_snapshots', 'client_meta_ads_snapshots', 'client_gsc_snapshots',
    'client_ga4_snapshots', 'client_gbp_snapshots', 'client_sitemap_snapshots',
    'client_lighthouse_snapshots', 'client_seo_crawl_snapshots', 'client_social_daily_snapshots'
  ) then
    raise exception 'latest_snapshot_per_client: table % is not allowed', p_table;
  end if;
  return query execute format(
    'select to_jsonb(t) from (
       select distinct on (client_id) * from public.%I
       where ($1::bigint is null or client_id = $1) %s
       order by client_id, created_at desc nulls last
     ) t',
    p_table,
    case when p_completed_only then 'and run_status = ''completed''' else '' end
  ) using p_client_id;
end;
$$;

grant execute on function public.latest_snapshot_per_client(text, bigint, boolean) to authenticated, service_role;
