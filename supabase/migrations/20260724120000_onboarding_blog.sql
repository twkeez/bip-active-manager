-- Blog onboarding: get the client onto the blog schedule. Writing posts is
-- ongoing, not onboarding — the only step is scheduling, with topic suggestions
-- drawn from our best-performing blog pages across all clients.

insert into public.client_onboarding_templates
  (item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
values
  ('blog_schedule', 'On the blog schedule', 'launch', 'required', 'manual:blog_schedule', 180, true, 'foundation', 'blog',
'Get them onto the blog schedule.
1. Add the client to our editorial / blog schedule at their cadence.
2. Suggest the first topics below — proven performers across our clients.
3. Mark done once they are scheduled.')
on conflict (item_key) do nothing;

-- Seed onto existing active-onboarding clients that have Blog.
insert into public.client_onboarding_items
  (client_id, item_key, label, category, severity, verification, sort_order, required_for_graduation, phase, requires_service, guidance)
select c.id, t.item_key, t.label, t.category, t.severity, t.verification, t.sort_order,
       t.required_for_graduation, t.phase, t.requires_service, t.guidance
from public.clients c
cross join public.client_onboarding_templates t
where t.item_key = 'blog_schedule'
  and c.onboarding_status = 'active'
  and coalesce(lower(c.blog), '') not in ('', 'n', 'no', 'none', 'na', 'n/a', '0', 'false')
on conflict (client_id, item_key) do nothing;
