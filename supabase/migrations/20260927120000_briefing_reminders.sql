-- Scheduled briefing reminders (Tom, 2026-09-26).
--
-- Each reminder is a follow-up of kind 'client_update', written the moment it
-- is sent. Unlike a note, it never closes on its own: a real client update is
-- the strategist's own wording, so only "Mark complete" closes it.
-- reminder_run is the run's Monday (2026-10-05), and the unique index makes a
-- re-run or a retry skip clients already reminded for that run.

alter table public.strategist_followups
  add column if not exists kind text not null default 'note'
    check (kind in ('note', 'client_update')),
  add column if not exists reminder_run date;

-- 8 marketing clients have no Basecamp project linked; their reminders are
-- still tracked (and closed by hand).
alter table public.strategist_followups
  alter column basecamp_project_id drop not null;

create unique index if not exists idx_strategist_followups_one_per_run
  on public.strategist_followups (client_id, reminder_run)
  where reminder_run is not null;

-- The routine that sends them. Created switched OFF: Tom turns it on from
-- Coal Mines once he has checked the preview and a test email. It wakes on
-- Mondays at 8, 10 and noon: it sends only on the first and third Monday,
-- and only once all five nightly syncs have finished that day. It holds until
-- noon, then fails loudly so the watchdog emails Tom.
insert into public.routines (key, name, instruction, kind, settings, schedule, enabled, created_by)
values (
  'briefing-reminders',
  'Client update reminders',
  'Send each client''s strategist a reminder, built from its briefing, to post a client update: Low Contact clients on the first Monday of the month (to Tom and Alex), everyone else on the first and third Mondays. Only clients with marketing services. Put each on the Follow-ups dashboard until marked complete.',
  'briefing_reminders',
  '{}'::jsonb,
  '{"days": [1], "hours": [8, 10, 12], "minute": 0, "timezone": "America/New_York"}'::jsonb,
  false,
  'tom@beyondindigo.com'
)
on conflict (key) do nothing;
