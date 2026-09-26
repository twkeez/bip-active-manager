-- A record of every scheduled job run, and of every alert sent about them.
--
-- Tom's rule (2026-09-26): nothing may fail to run without him being told.
-- GitHub's own logs only say a run happened; they do not say that a run was
-- skipped, and a job the platform kills at its time limit leaves no error at
-- all. Each job now writes a row as it starts and updates it as it finishes,
-- so a row still "running" long after the limit is a run that timed out, and
-- a job with no recent row is a run that never happened.

create table if not exists public.job_runs (
  id bigint generated always as identity primary key,
  job_key text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'ok', 'partial', 'failed')),
  http_status integer,
  summary text,
  detail jsonb
);

create index if not exists idx_job_runs_job_started
  on public.job_runs (job_key, started_at desc);

-- One row per problem we told Tom about (and one per daily summary), so the
-- hourly check reports each problem once instead of every hour.
create table if not exists public.job_alerts (
  id bigint generated always as identity primary key,
  problem_key text not null unique,
  job_key text,
  message text not null,
  sent_at timestamptz not null default now()
);

alter table public.job_runs enable row level security;
alter table public.job_alerts enable row level security;

grant select on public.job_runs to authenticated;
grant select on public.job_alerts to authenticated;

drop policy if exists "job_runs_select_authenticated" on public.job_runs;
create policy "job_runs_select_authenticated"
  on public.job_runs for select to authenticated using (true);

drop policy if exists "job_alerts_select_authenticated" on public.job_alerts;
create policy "job_alerts_select_authenticated"
  on public.job_alerts for select to authenticated using (true);
