-- The daily brief: every active client, most pressing first, saved once a day.
--
-- Built by code from numbers the app already stores (see lib/daily-brief), then
-- kept here so an earlier morning can be looked up. One row per Eastern
-- calendar date; running it again the same day replaces that day's row.
--
-- The brief names clients and their problems, so the table is closed to the
-- browser roles. The page reads it with the service role after checking the
-- person is an admin.

create table if not exists public.daily_briefs (
  brief_date date primary key,
  generated_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.daily_briefs enable row level security;

-- The routine that builds it, asked for on 2026-10-05. Weekdays at 6am Eastern,
-- after the nightly data syncs. The hourly routines job picks it up.
insert into public.routines (key, name, instruction, kind, settings, schedule, created_by)
values (
  'daily-brief',
  'Daily Brief',
  'Every weekday morning, give me a daily brief on a page in the app covering all active clients (not website-only accounts), with onboarding clients first, then clients who are chasing us, then clients that need action, then clients to keep an eye on.',
  'daily_brief',
  '{}'::jsonb,
  '{"days": [1, 2, 3, 4, 5], "hour": 6, "minute": 0, "timezone": "America/New_York"}'::jsonb,
  'tom@beyondindigo.com'
)
on conflict (key) do nothing;
