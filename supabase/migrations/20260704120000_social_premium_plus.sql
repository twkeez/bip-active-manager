-- Add a Social Media Premium Plus tier + starter playbook items.
-- Standard = client posts; Premium = we schedule 2 platforms; Premium Plus =
-- we run up to 3 platforms incl. video and engage the community for the client.

insert into public.strategy_mapper_service_tiers
  (tier_key, service, tier_label, tier_rank, title, objective, tactics, match_aliases)
values
  ('social-premium-plus', 'social', 'Premium Plus', 3, 'Social Media Marketing — Premium Plus',
   'Run the practice''s full social presence across platforms — including short-form video — and proactively grow and engage the local pet-owner community on their behalf.',
   '[]'::jsonb, '{}')
on conflict (tier_key) do nothing;

-- Starter items (Tom refines in the Playbook Library). Only seeds if none exist.
insert into public.playbook_items (tier_key, category, type, title, body, sort_order)
select tier_key, category, type, title, body, sort_order
from (values
  ('social-premium-plus', 'Initial Setup', 'checklist', 'Complete all Social Premium setup items',
   'Everything in the Premium tier applies, plus the additions below.', 10),
  ('social-premium-plus', 'Initial Setup', 'checklist', 'Add a third platform incl. short-form video',
   'Set up and optimize a third channel with a video focus (TikTok, Reels, or Shorts) suited to the practice.', 20),
  ('social-premium-plus', 'Monthly Work', 'checklist', 'Create and schedule ~16 posts/month',
   'Produce and schedule roughly 16 posts across platforms, mixing static, Stories, and video.', 30),
  ('social-premium-plus', 'Monthly Work', 'checklist', 'Produce short-form video / Reels',
   'Create short-form video content each month (Reels/TikTok/Shorts) from clinic footage or branded templates.', 40),
  ('social-premium-plus', 'Monthly Work', 'checklist', 'Proactive community management',
   'Engage and respond to comments and messages on the client''s behalf (with approval), and grow the local following.', 50),
  ('social-premium-plus', 'Monthly Work', 'checklist', 'Run a monthly campaign / seasonal series',
   'Plan and execute a themed campaign or seasonal content series each month.', 60),
  ('social-premium-plus', 'Monthly Communications', 'checklist', 'Quarterly social strategy',
   'Deliver a quarterly social strategy: audience growth, top-performing content, and next-quarter themes.', 70),
  ('social-premium-plus', 'Guidelines', 'guideline', 'We run it — set this expectation',
   'At Premium Plus we manage posting and engagement end to end; confirm approvals and brand voice up front.', 80)
) as v(tier_key, category, type, title, body, sort_order)
where not exists (
  select 1 from public.playbook_items where tier_key = 'social-premium-plus'
);
