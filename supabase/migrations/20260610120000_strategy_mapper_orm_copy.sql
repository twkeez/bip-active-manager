-- Finalize ORM tier copy and align social premium tactic with spec (no TODO placeholders)

update public.strategy_mapper_service_tiers
set
  objective = 'Establish baseline public review velocity for [Practice Name] by pivoting review generation momentum away from closed-loop platforms (like Demandforce) that keep client feedback internal and invisible, directing satisfied pet parents to your public Google Business Profile across [Practice Location].',
  tactics = '[
    "Closed-Loop Platform Transition: Pivot review generation momentum entirely away from closed-loop platforms (like Demandforce) that keep client feedback internal and invisible.",
    "Public GBP Review Workflow: Implement a structured post-visit review request workflow via automated SMS/Email triggers directing satisfied pet parents straight to your public Google Business Profile to aggressively build review velocity and close local star gaps."
  ]'::jsonb
where tier_key = 'orm-foundation';

update public.strategy_mapper_service_tiers
set
  objective = 'Accelerate public review velocity and competitive reputation positioning for [Practice Name] across your [Local Core Radius], closing the gap against neighborhood rivals with sustained GBP review generation.',
  tactics = '[
    "Review Velocity Acceleration: Deploy staff-accountable review generation protocols with weekly velocity targets tied to post-visit SMS/Email triggers.",
    "Competitive Reputation Gap Analysis: Monitor local star and review-count gaps against verified competitors and prioritize response management on high-visibility GBP feedback."
  ]'::jsonb
where tier_key = 'orm-premium';

update public.strategy_mapper_service_tiers
set
  tactics = '[
    "Clinical Outcome Storytelling: Design a structured system to capture and publish inspiring patient success transformations and clinical outcomes (such as before-and-after orthopedic recovery milestones or video-based healing case profiles), visibly proving your specialized care capabilities to a warm audience.",
    "Behind-The-Scenes Culture Spotlights: Produce authentic team features and medical park updates to showcase the human element of [Practice Name], lowering client barrier-to-trust for complex veterinary stays.",
    "Localized Growth & Engagement Mapping: Actively manage, monitor, and interact with community discussions, review comments, and platform messages to turn digital casual followers into lifelong, active clinic advocates."
  ]'::jsonb
where tier_key = 'social-premium';
