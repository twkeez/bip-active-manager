-- Upgrade the per-step guidance blurbs into real SOPs (the "how" a strategist
-- follows every time), shown in the onboarding wizard. Rendered multi-line, so
-- the numbered steps display as a checklist.

update public.client_onboarding_templates set guidance = case item_key
  when 'intake_account_profile' then
'Confirm the intake basics — everything downstream keys off these.
1. Verify the account name matches the contract.
2. Assign the marketing strategist.
3. Set the tier and monthly hours (total + strategist).
4. Fix anything the pipeline-form parse got wrong.'
  when 'intake_services' then
'Lock in exactly what they bought — this drives every step and playbook.
1. Set each service tier from the pipeline form (SEO, PPC, SMM, Blog, ORM).
2. Leave anything they did not buy as None.
3. Confirm Ads = PPC and the tier levels match the contract.'
  when 'intake_record_created' then
'Auto-completes — the client record exists in the tool. Nothing to do here.'
  when 'conn_website' then
'Add the live site URL on the Connections tab (Website row).
1. Use the final domain once it is live; for a rebuild, the old site works in the interim.
2. It powers audits, crawls, and reporting — keep it current.
Note: for a new build, this waits until the site launches.'
  when 'conn_basecamp' then
'Link the Basecamp project so client comms sync in.
1. Open the client Basecamp project.
2. Copy the project ID from the URL.
3. Paste it on the Connections tab.'
  when 'conn_search_console' then
'Set up Search Console (we usually create this ourselves).
1. Add a domain property (sc-domain:theirdomain.com) to cover www and non-www.
2. Verify via DNS TXT — send the record to the client or their web team.
3. Paste the property on the Connections tab and Sync.'
  when 'conn_google_ads' then
'Connect Google Ads (PPC clients).
1. Get the Ads customer ID (top-right of the account, XXX-XXX-XXXX).
2. Confirm we have manager (MCC) access.
3. Paste the ID on the Connections tab and Sync.'
  when 'conn_social' then
'Connect Facebook / Instagram (SMM clients).
1. Confirm the practice Page is assigned to our Business Manager.
2. Use Sync — it auto-matches by name.
3. If no match, map the Page manually.'
  when 'conn_ga4' then
'Add GA4 (comes set up for us).
1. Get the property ID (Admin, Property settings: properties/XXXXXXXXX).
2. Paste it on the Connections tab and Sync.
Recommended, not required to graduate.'
  when 'conn_place_id' then
'Google Business Profile.
1. Confirm the GBP exists and NAP (name, address, phone) matches the site.
2. Get the Place ID (Place ID finder, or the Maps lookup on Connections).
3. Paste it and Sync so reviews and local rank track.'
  when 'conn_harvest' then
'Add Harvest IDs for time tracking.
1. Open the client Harvest project.
2. Copy the project ID and client ID.
3. Paste both on the Connections tab.
Recommended, not required.'
  when 'comms_welcome' then
'Post the kickoff in Basecamp (generate and copy below).
1. Click Generate to build the quarterly Marketing Services message for their services.
2. Open or create the Marketing Services thread in Basecamp.
3. Paste it — warm, clear, sets the tone.'
  when 'comms_client_reply' then
'Auto-completes once the client replies to the kickoff. Nudge them if it has been a few days.'
  when 'comms_weekly_cadence' then
'Keep a client touchpoint at least weekly during onboarding.
1. Reply to their messages promptly.
2. If it has been 5+ days with no contact, reach out.
The tracker flags overdue for you.'
  when 'comms_expectations' then
'Set expectations early and document them in Basecamp.
1. Recap what we deliver per service and rough timelines.
2. Explain how and when we communicate and report.
3. For a pre-launch client, note what happens now vs at launch.'
  when 'launch_baseline_seo' then
'Capture the before (SEO clients, needs a live site).
1. Run the site audit (Lighthouse + crawl) on the current site.
2. Note the top 3 technical issues and content gaps.
Skip if greenfield; this is your baseline to show progress.'
  when 'launch_keywords' then
'Set tracked keywords — research now, no site needed.
1. Pull the practice core services.
2. Build the list: vet near me, veterinarian in [city], the practice name, plus top service and city combos.
3. Trim to the tier count (Premium 3, Premium Plus 10).
4. Add them in Reporting with the practice location.'
  when 'launch_reporting_prefs' then
'Set reporting preferences.
1. In Reporting, choose the metrics that matter to this client.
2. Save so monthly reports show the right KPIs.'
  else guidance
end;

-- Push the upgraded SOPs onto every already-seeded per-client item.
update public.client_onboarding_items i
set guidance = t.guidance
from public.client_onboarding_templates t
where i.item_key = t.item_key;
