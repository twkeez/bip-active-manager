-- Add Blog to the service playbook so Blog clients get an ongoing checklist.
-- (a) allow 'blog' as a service tier, (b) add Blog tiers, (c) seed starter items.

alter table public.strategy_mapper_service_tiers
  drop constraint if exists strategy_mapper_service_tiers_service_check;
alter table public.strategy_mapper_service_tiers
  add constraint strategy_mapper_service_tiers_service_check
  check (service in ('seo', 'ppc', 'orm', 'social', 'blog'));

insert into public.strategy_mapper_service_tiers
  (tier_key, service, tier_label, tier_rank, title, objective, tactics, match_aliases)
values
  ('blog-standard', 'blog', 'Standard', 1, 'Blog & Content — Standard',
   'Publish a steady stream of veterinary-focused, SEO-aligned content for pet owners.',
   '[]'::jsonb, '{}'),
  ('blog-premium', 'blog', 'Premium', 2, 'Blog & Content — Premium',
   'A fuller content program: richer cadence, original media, and ongoing refreshes.',
   '[]'::jsonb, '{}')
on conflict (tier_key) do nothing;

-- Starter Blog playbook items (Tom refines these in the Playbook Library). Only
-- seeds when no Blog items exist yet, so re-running won't clobber later edits.
insert into public.playbook_items (tier_key, category, type, title, body, sort_order)
select tier_key, category, type, title, body, sort_order
from (values
  ('blog-standard', 'Content Planning', 'checklist', 'Maintain a monthly content calendar',
   'Plan the month''s blog topics mapped to the client''s services and seasonal trends.', 10),
  ('blog-standard', 'Content Planning', 'checklist', 'Keyword-map each post',
   'Assign a target keyword or topic to every planned post so content supports SEO.', 20),
  ('blog-standard', 'Production', 'checklist', 'Draft posts in the client''s voice',
   'Write veterinary-focused, pet-owner-friendly articles aligned to the brand.', 30),
  ('blog-standard', 'Production', 'checklist', 'Editorial and on-brand review',
   'Proofread and confirm tone, accuracy, and brand alignment before publishing.', 40),
  ('blog-standard', 'Publishing', 'checklist', 'Publish on schedule with internal links',
   'Publish to the client''s blog and add internal links to relevant service/money pages.', 50),
  ('blog-standard', 'Performance', 'checklist', 'Monthly content performance check',
   'Review traffic and engagement on recent posts; note what to do more of.', 60),
  ('blog-premium', 'Content Planning', 'checklist', 'Maintain a monthly content calendar',
   'Plan the month''s blog topics mapped to the client''s services and seasonal trends.', 10),
  ('blog-premium', 'Content Planning', 'checklist', 'Keyword-map each post',
   'Assign a target keyword or topic to every planned post so content supports SEO.', 20),
  ('blog-premium', 'Content Planning', 'checklist', 'Quarterly content strategy refresh',
   'Revisit topic clusters and competitor content gaps each quarter.', 30),
  ('blog-premium', 'Production', 'checklist', 'Draft posts in the client''s voice',
   'Write veterinary-focused, pet-owner-friendly articles aligned to the brand.', 40),
  ('blog-premium', 'Production', 'checklist', 'Add original imagery or media',
   'Include custom images or graphics to lift engagement and shareability.', 50),
  ('blog-premium', 'Production', 'checklist', 'Editorial and on-brand review',
   'Proofread and confirm tone, accuracy, and brand alignment before publishing.', 60),
  ('blog-premium', 'Publishing', 'checklist', 'Publish on schedule with internal links',
   'Publish to the client''s blog and add internal links to relevant service/money pages.', 70),
  ('blog-premium', 'Performance', 'checklist', 'Refresh and re-optimize older posts',
   'Update high-potential older posts to recover and grow rankings.', 80)
) as v(tier_key, category, type, title, body, sort_order)
where not exists (
  select 1 from public.playbook_items where tier_key in ('blog-standard', 'blog-premium')
);
