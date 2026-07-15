-- Restructure onboarding around the cadence of meetings + deliverables. The
-- connection steps (GA4/Search Console/Ads/GBP/etc.) are dropped as steps and
-- become a red/yellow/green health light instead. Existing in-flight clients are
-- wiped separately, so we simply replace the template.

delete from public.client_onboarding_templates;

insert into public.client_onboarding_templates
  (item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
values
  ('intake_record_created', 'Client created in tool', 'intake', 'required', 'manual:record_created', 10, true, 'foundation', null,
'Auto-completes — the client record exists in the tool. Nothing to do here.'),
  ('intake_account_profile', 'Account profile: strategist, tier, hours', 'intake', 'required', 'manual:intake_profile', 20, true, 'foundation', null,
'Confirm the intake basics — everything downstream keys off these.
1. Assign the marketing strategist.
2. Set the tier and monthly hours (total + strategist).
3. Fix anything the pipeline-form parse got wrong.'),
  ('intake_services', 'Services confirmed', 'intake', 'required', 'manual:intake_services', 30, true, 'foundation', null,
'Lock in exactly what they bought — this drives every step and deliverable.
1. Confirm each service tier from the pipeline form (SEO, PPC, SMM, Blog, ORM).
2. Leave anything they did not buy as None.'),
  ('kickoff_thread', 'Start the Basecamp Marketing Services thread', 'communication', 'required', 'manual:comms_welcome', 40, true, 'foundation', null,
'Post the kickoff in Basecamp (generate + copy below).
1. Generate the quarterly Marketing Services message for their services.
2. Open or create the Marketing Services thread in Basecamp.
3. Paste it — warm, clear, sets the tone.'),
  ('arm_strategist', 'Prep the strategist — brief + research', 'launch', 'required', 'manual:arm_strategist', 50, true, 'foundation', null,
'Give the strategist what they need for the meeting.
1. Run the AI discovery to pull business info, competitors, and the keyword/local landscape.
2. Review the brief so you walk in prepared.
(Discovery will run right here.)'),
  ('client_meeting', 'Schedule + hold the onboarding meeting', 'communication', 'required', 'manual:client_meeting', 60, true, 'foundation', null,
'Get the client to the onboarding meeting.
1. Confirm the meeting is scheduled (the website team may drive it).
2. If marketing is paid and no meeting is set soon, reach out via Basecamp.
3. Mark it held once it happens; verify the business info and gather competitors during it.'),
  ('client_reply', 'Client responded to kickoff', 'communication', 'recommended', 'comms:client_reply', 70, false, 'foundation', null,
'Auto-completes once the client replies to the kickoff. Nudge them if it has been a few days.'),
  ('weekly_cadence', 'Weekly client touchpoint', 'communication', 'required', 'comms:weekly_cadence', 80, true, 'foundation', null,
'Keep a client touchpoint at least weekly during onboarding.
1. Reply to their messages promptly.
2. If it has been 5+ days with no contact, reach out.
The tracker flags overdue for you.'),
  ('research_keywords', 'Keyword + local research', 'launch', 'recommended', 'snapshot:keyword_targets', 90, false, 'foundation', 'seo',
'Keyword + local research (SEO).
1. Pull the practice core services.
2. Build the list: vet near me, veterinarian in [city], the practice name, plus service and city combos.
3. Trim to the tier count (Premium 3, Premium Plus 10) and add them in Reporting.'),
  ('deliverables_kickoff', 'First deliverables out', 'launch', 'required', 'manual:deliverables', 100, true, 'foundation', null,
'Kick off the first deliverables.
1. Line up the service deliverables (e.g. SEO site audit, social access doc).
2. Send what you can now; the rest follow the cadence.
(Service-specific deliverables are coming next.)')
on conflict (item_key) do nothing;
