-- PPC (Google Ads) onboarding deliverables. Mostly strategist-delivered work
-- (we create the account, plan, and run it — the client only adds billing).
-- Conversion tracking + launch are at_launch: they need the landing page live
-- (deferred for a new build; available now for an existing site).

insert into public.client_onboarding_templates
  (item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
values
  ('ppc_account_setup', 'Set up the Google Ads account', 'launch', 'required', 'manual:ppc_account', 110, true, 'foundation', 'ppc',
'Set up the Google Ads account — we create it, never work out of the client''s account.
1. Create a new account under our manager (MCC).
2. Invite the client with billing access and send them the Billing settings link to add their card — we never touch payment.
3. Confirm billing is active before anything runs.'),
  ('ppc_competitor_ads', 'Competitor ad check', 'launch', 'recommended', 'manual:ppc_competitors', 120, false, 'foundation', 'ppc',
'Check what competitors are running.
1. Search the practice''s core services + city and note who is advertising.
2. Capture their offers, angles, and extensions.
3. Use it to position our campaigns and exploit their gaps.'),
  ('ppc_campaign_plan', 'Campaign plan + negative keywords', 'launch', 'required', 'manual:ppc_campaign', 130, true, 'foundation', 'ppc',
'Build the initial campaign plan.
1. Structure campaigns / ad groups by service (wellness, dental, emergency).
2. Set targeting (service-area radius), budget split, and initial keywords.
3. Draft the negative-keyword list to cut wasted spend.'),
  ('ppc_conversion_tracking', 'Conversion tracking', 'launch', 'required', 'manual:ppc_conversion', 140, true, 'at_launch', 'ppc',
'Set up conversion tracking once the landing page is live.
1. Google Ads call conversions (Google forwarding numbers — native, no third party) for phone calls.
2. Form-fill and online-booking conversions via GA4 / GTM events.
3. Verify conversions fire before scaling spend.'),
  ('ppc_launch', 'Launch the campaign', 'launch', 'required', 'manual:ppc_launch', 150, true, 'at_launch', 'ppc',
'Launch the campaign.
1. Confirm the splash / landing page (or existing site) is live and billing is active.
2. Turn campaigns on at the planned start (tie to the opening date if pre-launch).
3. Monitor the first days closely and adjust.')
on conflict (item_key) do nothing;

-- Seed the PPC steps onto existing active-onboarding clients that have PPC.
insert into public.client_onboarding_items
  (client_id, item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
select c.id, t.item_key, t.label, t.category, t.severity, t.verification, t.sort_order,
       t.required_for_graduation, t.phase, t.requires_service, t.guidance
from public.clients c
cross join public.client_onboarding_templates t
where t.item_key in ('ppc_account_setup', 'ppc_competitor_ads', 'ppc_campaign_plan', 'ppc_conversion_tracking', 'ppc_launch')
  and c.onboarding_status = 'active'
  and coalesce(lower(c.ppc), '') not in ('', 'n', 'no', 'none', 'na', 'n/a', '0', 'false')
on conflict (client_id, item_key) do nothing;
