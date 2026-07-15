-- SEO onboarding deliverables (tier gating handled in-app): the site audit and
-- baseline rankings. Both are at_launch (they need a live site), so they defer
-- for new builds and are available now for existing-site clients.

insert into public.client_onboarding_templates
  (item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
values
  ('deliverable_site_audit', 'Site audit', 'launch', 'required', 'snapshot:seo_baseline', 92, true, 'at_launch', 'seo',
'Run the baseline site audit (needs a live site).
1. Click Run site audit — captures the current Lighthouse + crawl state.
2. Note the top issues; they seed the go-live recommendations.
Deferred until launch for a new build.'),
  ('deliverable_baseline_rankings', 'Baseline rankings', 'launch', 'required', 'manual:baseline_rankings', 94, true, 'at_launch', 'seo',
'Capture where they rank today, once connected.
1. Needs the website, Google Place ID, and tracked keywords in place.
2. Click Run baseline rankings, then Mark done.
This is the before snapshot to show progress against.')
on conflict (item_key) do nothing;

-- Seed the two steps onto existing active-onboarding clients that have SEO.
insert into public.client_onboarding_items
  (client_id, item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
select c.id, t.item_key, t.label, t.category, t.severity, t.verification, t.sort_order,
       t.required_for_graduation, t.phase, t.requires_service, t.guidance
from public.clients c
cross join public.client_onboarding_templates t
where t.item_key in ('deliverable_site_audit', 'deliverable_baseline_rankings')
  and c.onboarding_status = 'active'
  and coalesce(lower(c.seo), '') not in ('', 'n', 'no', 'none', 'na', 'n/a', '0', 'false')
on conflict (client_id, item_key) do nothing;
