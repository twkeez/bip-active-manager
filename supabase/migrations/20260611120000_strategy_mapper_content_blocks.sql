-- Strategy Mapper content blocks + sales document storage

create table if not exists public.strategy_mapper_content_blocks (
  id bigint generated always as identity primary key,
  block_key text not null unique,
  category text not null check (category in (
    'executive', 'keyword_row', 'launch_step', 'upsell_why'
  )),
  primary_goal text null,
  service text null check (service is null or service in ('seo', 'ppc', 'orm', 'social')),
  framing text null check (framing is null or framing in (
    'optimization', 'introduction', 'reputation_gap', 'community'
  )),
  sort_order int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategy_mapper_content_blocks_category
  on public.strategy_mapper_content_blocks (category, sort_order);

grant select, insert, update, delete on public.strategy_mapper_content_blocks to authenticated;

alter table public.strategy_mapper_content_blocks enable row level security;

create policy "strategy_mapper_content_blocks_select_authenticated"
  on public.strategy_mapper_content_blocks
  for select to authenticated
  using (true);

create policy "strategy_mapper_content_blocks_insert_authenticated"
  on public.strategy_mapper_content_blocks
  for insert to authenticated
  with check (true);

create policy "strategy_mapper_content_blocks_update_authenticated"
  on public.strategy_mapper_content_blocks
  for update to authenticated
  using (true)
  with check (true);

create policy "strategy_mapper_content_blocks_delete_authenticated"
  on public.strategy_mapper_content_blocks
  for delete to authenticated
  using (true);

-- Executive summary templates keyed by primary business goal
insert into public.strategy_mapper_content_blocks
  (block_key, category, primary_goal, sort_order, payload)
values
  (
    'executive-general-acquisition',
    'executive',
    'General new client acquisition / Market dominance',
    1,
    '{
      "missionStatement": "Establish [Practice Name] as the trusted local choice for pet parents across [City] — converting search visibility into steady new-client volume.",
      "narrative": "This plan focuses on [Primary Goal] within a [Local Core Radius] wellness footprint. We will align Phase 1 services with verified local competitive benchmarks and the operational realities captured in your intake notes.",
      "painPointResolution": "We will address documented agency and vendor frustrations directly — replacing unresponsive administration with accountable execution and measurable local search progress.",
      "coreFocusAreas": [
        "Local map pack and organic visibility within [Local Core Radius]",
        "GBP review velocity and reputation signals vs [Top Competitor]",
        "High-intent keyword coverage aligned to [Practice Type]",
        "Conversion-ready landing paths for [Primary Goal]"
      ]
    }'::jsonb
  ),
  (
    'executive-high-ticket',
    'executive',
    'Increase high-ticket dental, surgical, or therapeutic procedures',
    2,
    '{
      "missionStatement": "Position [Practice Name] as the premier [Specialty] choice for regional pet parents — with transparent positioning that converts high-intent surgical and therapeutic searches.",
      "narrative": "This strategy targets [Primary Goal] by pairing local wellness capture with regional specialty draw where [Specialty] differentiators apply. Competitive gaps vs [Top Competitor] inform prioritization.",
      "painPointResolution": "We will resolve operational bottlenecks cited in intake — freeing the team from broken review syndication and unresponsive web administration while publishing clinical specificity prospects can trust.",
      "coreFocusAreas": [
        "Regional landing pages for [Specialty] procedures",
        "Transparent pricing and procedure naming in ad and SEO copy",
        "GBP and review velocity correction vs [Top Competitor]",
        "Associate and surgeon calendar fill via high-intent keywords"
      ]
    }'::jsonb
  ),
  (
    'executive-associate-calendar',
    'executive',
    'Fill a new associate veterinarian''s calendar',
    3,
    '{
      "missionStatement": "Build predictable new-client flow for [Practice Name] so your associate DVM calendar fills with wellness and urgent-care demand inside [Local Core Radius].",
      "narrative": "This plan aligns Phase 1 tactics to [Primary Goal] — emphasizing everyday wellness keywords and map pack dominance before specialty campaigns.",
      "painPointResolution": "We will remove friction from past vendor and agency experiences while establishing reliable local discovery paths that keep the associate schedule productive.",
      "coreFocusAreas": [
        "Wellness and urgent-care keyword clusters for [City]",
        "GBP engagement and review velocity vs [Top Competitor]",
        "On-site service page optimization for everyday care",
        "Paid search support for calendar-fill campaigns where applicable"
      ]
    }'::jsonb
  ),
  (
    'executive-reputation',
    'executive',
    'Reputation management/Repair negative search presence',
    4,
    '{
      "missionStatement": "Restore and protect [Practice Name]''s public reputation so local pet parents encounter accurate, trust-building signals across Google and core directories.",
      "narrative": "This roadmap prioritizes [Primary Goal] — closing the [Review Gap]-review gap vs [Top Competitor] while stabilizing listings, reviews, and branded search results.",
      "painPointResolution": "We will migrate review velocity off closed-loop platforms into public GBP syndication and address documented vendor frustrations with accountable reputation workflows.",
      "coreFocusAreas": [
        "GBP review velocity and response protocol",
        "Citation and NAP consistency across directories",
        "Branded SERP cleanup and monitoring",
        "Localized content reinforcing care quality and transparency"
      ]
    }'::jsonb
  ),
  (
    'executive-fallback',
    'executive',
    null,
    99,
    '{
      "missionStatement": "Grow [Practice Name]''s local visibility and new-client pipeline across [City] with a data-backed Phase 1 marketing foundation.",
      "narrative": "This plan assembles tier-library Phase 1 tactics, verified competitive benchmarks, and strategist checklist items into a single onboarding-ready document.",
      "painPointResolution": "We will address intake pain points and past agency frustrations with accountable execution and measurable progress checkpoints.",
      "coreFocusAreas": [
        "Local search visibility within [Local Core Radius]",
        "Competitive positioning vs [Top Competitor]",
        "Phase 1 service alignment to [Primary Goal]",
        "Onboarding workspace and asset collection"
      ]
    }'::jsonb
  )
on conflict (block_key) do nothing;

-- SEO keyword matrix rows
insert into public.strategy_mapper_content_blocks
  (block_key, category, sort_order, payload)
values
  (
    'keyword-local-wellness',
    'keyword_row',
    1,
    '{
      "intentCategory": "Local Core (General Wellness)",
      "targetGeography": "[City] ([Wellness Radius] mi)",
      "keywordVariations": [
        "vet near me",
        "animal hospital [City]",
        "veterinarian [City]"
      ]
    }'::jsonb
  ),
  (
    'keyword-specialty-regional',
    'keyword_row',
    2,
    '{
      "intentCategory": "High-Intent Specialty (Regional)",
      "targetGeography": "[Practice Location] ([Regional Radius])",
      "keywordVariations": [
        "[Specialty] vet near me",
        "veterinary [Specialty] [City]",
        "affordable [Specialty] veterinarian"
      ]
    }'::jsonb
  )
on conflict (block_key) do nothing;

-- Launch roadmap steps
insert into public.strategy_mapper_content_blocks
  (block_key, category, sort_order, payload)
values
  (
    'launch-step-1',
    'launch_step',
    1,
    '{
      "stepNumber": 1,
      "title": "Kickoff Meeting",
      "description": "Align on [Primary Goal], Phase 1 services ([Active Services]), and onboarding milestones for [Practice Name]."
    }'::jsonb
  ),
  (
    'launch-step-2',
    'launch_step',
    2,
    '{
      "stepNumber": 2,
      "title": "Technical Asset Gathering",
      "description": "Collect GBP admin, analytics access, website CMS logins, and any creative assets referenced in sales context for [Practice Name]."
    }'::jsonb
  ),
  (
    'launch-step-3',
    'launch_step',
    3,
    '{
      "stepNumber": 3,
      "title": "Strategy Launch Day",
      "description": "Publish tier-library Phase 1 tactics, activate keyword matrix targets, and schedule the first 30-day optimization checkpoint."
    }'::jsonb
  )
on conflict (block_key) do nothing;

-- Phase 2 upsell why-it-matters templates
insert into public.strategy_mapper_content_blocks
  (block_key, category, service, framing, sort_order, payload)
values
  ('upsell-orm-reputation_gap', 'upsell_why', 'orm', 'reputation_gap', 1,
    '{"whyItMatters": "Closing the [Review Gap]-review gap vs [Top Competitor] is the fastest lever to improve local conversion rates without increasing ad spend."}'::jsonb),
  ('upsell-ppc-introduction', 'upsell_why', 'ppc', 'introduction', 2,
    '{"whyItMatters": "Local competitors including [Top Competitor] are capturing high-intent clicks on Google — structured PPC management closes that demand leak for [Practice Name]."}'::jsonb),
  ('upsell-ppc-optimization', 'upsell_why', 'ppc', 'optimization', 3,
    '{"whyItMatters": "Self-managed ads can be refined with professional structure, negative keyword governance, and landing-page alignment to lower cost per new client for [Practice Name]."}'::jsonb),
  ('upsell-social-community', 'upsell_why', 'social', 'community', 4,
    '{"whyItMatters": "Regional pet parents researching providers increasingly validate trust through social proof — a structured content program pre-sells complex stays before the first phone call."}'::jsonb),
  ('upsell-seo-optimization', 'upsell_why', 'seo', 'optimization', 5,
    '{"whyItMatters": "Expanding organic coverage beyond baseline listings captures everyday wellness searches competitors rank for today in [City]."}'::jsonb),
  ('upsell-orm-optimization', 'upsell_why', 'orm', 'optimization', 6,
    '{"whyItMatters": "A proactive review response and syndication program protects map pack visibility as [Practice Name] scales new-client volume."}'::jsonb),
  ('upsell-social-introduction', 'upsell_why', 'social', 'introduction', 7,
    '{"whyItMatters": "Competitors maintain active social cadence while [Practice Name] has no structured program — closing that gap builds community trust in [City]."}'::jsonb),
  ('upsell-seo-introduction', 'upsell_why', 'seo', 'introduction', 8,
    '{"whyItMatters": "Baseline digital presence is necessary but insufficient — active SEO unlocks sustained organic growth for [Primary Goal]."}'::jsonb)
on conflict (block_key) do nothing;

-- Private storage bucket for reference-only sales documents
insert into storage.buckets (id, name, public)
values ('strategy-mapper-sales-docs', 'strategy-mapper-sales-docs', false)
on conflict (id) do nothing;

create policy "strategy_mapper_sales_docs_select_own"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'strategy-mapper-sales-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "strategy_mapper_sales_docs_insert_own"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'strategy-mapper-sales-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "strategy_mapper_sales_docs_update_own"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'strategy-mapper-sales-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'strategy-mapper-sales-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "strategy_mapper_sales_docs_delete_own"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'strategy-mapper-sales-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
