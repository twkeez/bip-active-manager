-- ORM onboarding: connect the Google Business Profile (so we monitor reviews)
-- and set the client up in GatherUp (review solicitation + dashboard).

insert into public.client_onboarding_templates
  (item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
values
  ('orm_connect_gbp', 'Connect Google Business Profile', 'connections', 'required', 'setup:google_place_id', 190, true, 'foundation', 'orm',
'Connect their Google Business Profile so we monitor reviews.
1. Get the Google Place ID (Connections tab, or the Maps lookup).
2. Paste it and sync — reviews start flowing.
(If SEO is also active, this may already be connected.)'),
  ('orm_gatherup', 'Set up in GatherUp', 'launch', 'required', 'manual:orm_gatherup', 200, true, 'foundation', 'orm',
'Set the client up in GatherUp (review solicitation + dashboard).
1. Add the client / location in GatherUp.
2. Configure the review-request campaign.
3. Confirm the dashboard is live, then Mark done.')
on conflict (item_key) do nothing;

-- Seed onto existing active-onboarding clients that have ORM.
insert into public.client_onboarding_items
  (client_id, item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
select c.id, t.item_key, t.label, t.category, t.severity, t.verification, t.sort_order,
       t.required_for_graduation, t.phase, t.requires_service, t.guidance
from public.clients c
cross join public.client_onboarding_templates t
where t.item_key in ('orm_connect_gbp', 'orm_gatherup')
  and c.onboarding_status = 'active'
  and coalesce(lower(c.orm), '') not in ('', 'n', 'no', 'none', 'na', 'n/a', '0', 'false')
on conflict (client_id, item_key) do nothing;
