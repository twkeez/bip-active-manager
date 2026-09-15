-- Canaries you write yourself, in plain language.
--
-- The built-in canaries are TypeScript functions, which means every new thing
-- worth watching is a deploy and a developer. Most of what is worth watching
-- here is not complicated — "a client paying for Blog with no post in 45 days",
-- "an onboarding stuck at the same step for a month" — it is just specific, and
-- there are more of them than anyone will ever ask to be built one at a time.
--
-- So: you describe the check, Claude writes a read-only query for it, you see
-- what it finds before you save it, and it joins the board.

create table if not exists public.coal_mine_canaries (
  id bigint generated always as identity primary key,
  -- Stable slug. The board keys on it, so renaming the canary keeps its place.
  key text not null unique,
  name text not null,
  -- What it watches, in plain language — shown under the name on the board.
  watches text not null,
  -- What you actually typed. Kept verbatim: it is the thing to re-read when the
  -- query turns out to answer a subtly different question than you meant.
  instruction text not null,
  -- The read-only SELECT Claude wrote from that instruction.
  query_sql text not null,

  -- Copy. A canary that finds nothing still has to say something reassuring,
  -- and one that finds things has to say how many without the row count
  -- reading as noise.
  headline_none text not null,
  headline_some text not null,
  -- Which column of the result names the row, and which ones qualify it.
  item_label_column text not null,
  item_meta_columns text[] not null default '{}',
  -- e.g. /dashboard/clients/{client_id} — {column} is substituted per row.
  href_template text,

  -- How loudly to report a finding. Nothing here is ever "ok with findings":
  -- if it found something, it wanted your attention.
  severity text not null default 'attention' check (severity in ('attention', 'overdue')),
  enabled boolean not null default true,

  -- Last result, denormalised so the board can show status without reading the
  -- whole run history.
  last_run_at timestamptz,
  last_status text check (last_status in ('ok', 'attention', 'overdue', 'error')),
  last_finding_count int,
  last_error text,

  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every run, so "has this been getting worse?" is answerable and a canary that
-- flaps between states is visible as flapping rather than as bad luck.
create table if not exists public.coal_mine_canary_runs (
  id bigint generated always as identity primary key,
  canary_id bigint not null references public.coal_mine_canaries(id) on delete cascade,
  ran_at timestamptz not null default now(),
  status text not null check (status in ('ok', 'attention', 'overdue', 'error')),
  finding_count int not null default 0,
  headline text not null,
  findings jsonb not null default '[]'::jsonb,
  error_message text,
  duration_ms int
);

create index if not exists idx_coal_mine_canary_runs_canary
  on public.coal_mine_canary_runs (canary_id, ran_at desc);

alter table public.coal_mine_canaries enable row level security;
alter table public.coal_mine_canary_runs enable row level security;

grant select on public.coal_mine_canaries to authenticated;
grant select on public.coal_mine_canary_runs to authenticated;

drop policy if exists "coal_mine_canaries_select_authenticated" on public.coal_mine_canaries;
create policy "coal_mine_canaries_select_authenticated"
  on public.coal_mine_canaries
  for select
  to authenticated
  using (true);

drop policy if exists "coal_mine_canary_runs_select_authenticated" on public.coal_mine_canary_runs;
create policy "coal_mine_canary_runs_select_authenticated"
  on public.coal_mine_canary_runs
  for select
  to authenticated
  using (true);

-- Writes go through the service role, with the admin check in the route —
-- the same arrangement as every other admin-managed table here.

-- The one place a generated query is allowed to run.
--
-- Three guards, deliberately overlapping, because the query text is written by
-- a language model from a sentence somebody typed:
--
--   1. The app refuses anything that is not a single SELECT before it gets
--      here (lib/coal-mines/query-guard.ts).
--   2. This function refuses anything not starting with SELECT or WITH.
--   3. The transaction is made read-only before the query runs, so Postgres
--      itself rejects any write — this is the guard that does not depend on
--      anyone having thought of the right keyword to blocklist.
--
-- A statement timeout stops a careless join from holding a connection, and the
-- row limit keeps a runaway result from becoming the response body.
--
-- SECURITY DEFINER so it reads past RLS: this is an admin monitoring tool and a
-- canary that silently sees a subset of the rows is worse than no canary.
create or replace function public.coal_mine_readonly_query(
  query_text text,
  row_limit int default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if query_text !~* '^\s*(select|with)\s' then
    raise exception 'Only SELECT queries can run here.';
  end if;

  if row_limit is null or row_limit < 1 or row_limit > 1000 then
    raise exception 'row_limit must be between 1 and 1000.';
  end if;

  -- Both local to this transaction, so nothing leaks into the next caller.
  perform set_config('transaction_read_only', 'on', true);
  perform set_config('statement_timeout', '15s', true);

  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) q limit %s) t',
    query_text,
    row_limit
  )
  into result;

  return result;
end;
$$;

-- Only the app may call it, and the app calls it with the service role. An
-- authenticated user reaching PostgREST directly must not get a SQL console.
revoke all on function public.coal_mine_readonly_query(text, int) from public;
revoke all on function public.coal_mine_readonly_query(text, int) from anon;
revoke all on function public.coal_mine_readonly_query(text, int) from authenticated;
grant execute on function public.coal_mine_readonly_query(text, int) to service_role;
