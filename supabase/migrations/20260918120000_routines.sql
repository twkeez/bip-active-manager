-- Routines: things the app does on its own, on a schedule, that someone asked
-- for in their own words.
--
-- Coal Mines canaries watch and report when somebody opens the page. A routine
-- runs at a set time whether or not anyone is looking, and keeps a record of
-- every run, so "did the review happen this morning, and what did it say?" is
-- answerable without trusting that a job fired.
--
-- Each routine names a built-in kind of job and its settings. The instruction
-- is stored in the words it was asked in, beside the job that answers it.

create table if not exists public.routines (
  id bigint generated always as identity primary key,
  key text not null unique,
  name text not null,
  -- What was asked for, verbatim. Shown on the page; never executed.
  instruction text not null,
  -- Which built-in job does the work, e.g. 'basecamp_review'.
  kind text not null,
  settings jsonb not null default '{}'::jsonb,
  -- {"days":[1,2,3,4,5],"hour":9,"minute":0,"timezone":"America/New_York"}.
  -- Stored as a person says it rather than as UTC cron, so 9am stays 9am
  -- across the clock change.
  schedule jsonb not null,
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_status text check (last_status in ('ok', 'attention', 'error')),
  last_headline text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routine_runs (
  id bigint generated always as identity primary key,
  routine_id bigint not null references public.routines(id) on delete cascade,
  trigger text not null check (trigger in ('schedule', 'manual')),
  started_at timestamptz not null default now(),
  -- Null while running. A run that stays unfinished crashed part-way, and
  -- shows as such rather than disappearing.
  finished_at timestamptz,
  status text check (status in ('ok', 'attention', 'error')),
  headline text,
  findings jsonb not null default '[]'::jsonb,
  error_message text
);

create index if not exists idx_routine_runs_routine_started
  on public.routine_runs (routine_id, started_at desc);

alter table public.routines enable row level security;
alter table public.routine_runs enable row level security;

grant select on public.routines to authenticated;
grant select on public.routine_runs to authenticated;

drop policy if exists "routines_select_authenticated" on public.routines;
create policy "routines_select_authenticated"
  on public.routines for select to authenticated using (true);

drop policy if exists "routine_runs_select_authenticated" on public.routine_runs;
create policy "routine_runs_select_authenticated"
  on public.routine_runs for select to authenticated using (true);

-- Writes go through the app's API with the service role, which checks the
-- person is an admin.

-- The first routine, as asked for on 2026-09-18.
insert into public.routines (key, name, instruction, kind, settings, schedule, created_by)
values (
  'daily-basecamp-review',
  'Daily Basecamp Review',
  'Search my Basecamp threads to determine which need a reply, and which haven''t had anything posted in 14 days or longer.',
  'basecamp_review',
  '{"replyAfterDays": 3, "quietAfterDays": 14}'::jsonb,
  '{"days": [1, 2, 3, 4, 5], "hour": 9, "minute": 0, "timezone": "America/New_York"}'::jsonb,
  'tom@beyondindigo.com'
)
on conflict (key) do nothing;
