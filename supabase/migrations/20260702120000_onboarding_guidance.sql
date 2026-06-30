-- Per-step guidance for the onboarding wizard: a short "what to do / why" blurb
-- shown alongside each step. Admin-editable; defaults seeded below.

alter table public.client_onboarding_templates add column if not exists guidance text;
alter table public.client_onboarding_items add column if not exists guidance text;

update public.client_onboarding_templates set guidance = case item_key
  when 'intake_account_profile' then 'Confirm the basics are right: account name, the assigned strategist, the package tier, and the monthly hours. Everything downstream keys off these.'
  when 'intake_services' then 'Mark exactly which services this client bought (SEO, PPC, SMM, Blog, ORM). This drives which onboarding steps and ongoing playbook they get — so get it right.'
  when 'intake_record_created' then 'The client record exists in the tool. Nothing to do here — it auto-completes.'
  when 'conn_website' then 'Add the client''s live website URL on the Connections tab. It powers audits, crawls, and reporting.'
  when 'conn_basecamp' then 'Link the Basecamp project so client communication syncs into the tool. Find the project ID in the Basecamp URL.'
  when 'conn_search_console' then 'Add the Search Console property URL so we can pull keyword and indexing data. Make sure we have access in GSC.'
  when 'conn_google_ads' then 'Add the Google Ads customer ID and confirm we have manager access so PPC data syncs.'
  when 'conn_social' then 'Connect the client''s social account so SMM posting and engagement can be tracked.'
  when 'conn_ga4' then 'Add the GA4 property ID for traffic and conversion reporting. Recommended but not required to graduate.'
  when 'conn_place_id' then 'Add the Google Place ID so we can track the Business Profile and local rankings.'
  when 'conn_harvest' then 'Add the Harvest project and client IDs for time tracking. Recommended, not required.'
  when 'comms_welcome' then 'Start the quarterly Basecamp thread and post the kickoff message (generate and copy it below). This is the client''s first impression — make it warm and clear.'
  when 'comms_client_reply' then 'Wait for the client to reply to the kickoff. Auto-completes once we see a client response in Basecamp.'
  when 'comms_weekly_cadence' then 'Keep a touchpoint with the client at least weekly during onboarding. The tracker flags you if it''s been too long.'
  when 'comms_expectations' then 'Document the intro and set expectations: what we''ll deliver, timelines, and how we''ll communicate.'
  when 'launch_baseline_seo' then 'Run a baseline SEO crawl or Lighthouse so we can show progress later. Recommended for SEO clients.'
  when 'launch_keywords' then 'Add the client''s target keywords so rank tracking and reporting have a baseline.'
  when 'launch_reporting_prefs' then 'Save the client''s reporting metric preferences so monthly reports show what matters to them.'
  else guidance
end
where guidance is null;

-- Backfill guidance onto any already-seeded per-client items from the template.
update public.client_onboarding_items i
set guidance = t.guidance
from public.client_onboarding_templates t
where i.item_key = t.item_key and i.guidance is null;
