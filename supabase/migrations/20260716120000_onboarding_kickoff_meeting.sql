-- Trim the comms steps: drop the client-reply + weekly-touchpoint steps, and
-- reduce the meeting step to just tracking if/when the kickoff meeting is
-- scheduled (the only strategist input needed there).

delete from public.client_onboarding_templates where item_key in ('client_reply', 'weekly_cadence');
delete from public.client_onboarding_items where item_key in ('client_reply', 'weekly_cadence');

update public.client_onboarding_templates
  set label = 'Kickoff meeting scheduled',
      verification = 'state:kickoff_meeting',
      severity = 'required',
      guidance = 'Track if/when the kickoff meeting is scheduled — the only input needed here.
1. Once a date is set (the website team or you set it up), enter it below.
2. The rest happens in the meeting itself.'
  where item_key = 'client_meeting';

update public.client_onboarding_items
  set label = 'Kickoff meeting scheduled',
      verification = 'state:kickoff_meeting',
      severity = 'required',
      guidance = 'Track if/when the kickoff meeting is scheduled — the only input needed here.
1. Once a date is set (the website team or you set it up), enter it below.
2. The rest happens in the meeting itself.'
  where item_key = 'client_meeting';

alter table public.client_onboarding_intake
  add column if not exists kickoff_meeting_at date;
