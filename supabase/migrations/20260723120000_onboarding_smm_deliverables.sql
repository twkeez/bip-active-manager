-- SMM (Social) onboarding: connect their accounts into our Business Suite, and
-- gather brand assets (with a pull-from-website assist). Content is ongoing, not
-- an onboarding step. All foundation — social doesn't need the site to launch.

insert into public.client_onboarding_templates
  (item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
values
  ('smm_connect', 'Connect social accounts', 'connections', 'required', 'setup:social_connection', 160, true, 'foundation', 'smm',
'Get access to their Facebook + Instagram and pull them into our Business Suite.
1. Send the client the "grant us access" doc (Reference Library).
2. Once they assign the Page + Instagram to our Business Suite, connect it here (Connections -> Social sync).
3. Confirm posts + metrics start flowing.'),
  ('smm_brand_assets', 'Brand assets', 'launch', 'recommended', 'manual:smm_brand_assets', 170, false, 'foundation', 'smm',
'Gather the brand assets for content.
1. Pull brand elements from their website (logo, colors, hero image) — click below.
2. Collect the rest: high-res logo, photos, brand voice / guidelines.
3. If we are creating a new logo or site, pull these later once it exists.')
on conflict (item_key) do nothing;

alter table public.client_onboarding_intake
  add column if not exists brand_elements jsonb,
  add column if not exists brand_elements_at timestamptz;

-- Seed the SMM steps onto existing active-onboarding clients that have SMM.
insert into public.client_onboarding_items
  (client_id, item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
select c.id, t.item_key, t.label, t.category, t.severity, t.verification, t.sort_order,
       t.required_for_graduation, t.phase, t.requires_service, t.guidance
from public.clients c
cross join public.client_onboarding_templates t
where t.item_key in ('smm_connect', 'smm_brand_assets')
  and c.onboarding_status = 'active'
  and coalesce(lower(c.smm), '') not in ('', 'n', 'no', 'none', 'na', 'n/a', '0', 'false')
on conflict (client_id, item_key) do nothing;
