create table if not exists public.strategy_mapper_service_tiers (
  id bigint generated always as identity primary key,
  tier_key text not null unique,
  service text not null check (service in ('seo', 'ppc', 'orm', 'social')),
  tier_label text not null,
  tier_rank int not null,
  title text not null,
  objective text not null,
  tactics jsonb not null default '[]'::jsonb,
  match_aliases text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategy_mapper_service_tiers_service_rank
  on public.strategy_mapper_service_tiers (service, tier_rank);

grant select, insert, update, delete on public.strategy_mapper_service_tiers to authenticated;

alter table public.strategy_mapper_service_tiers enable row level security;

create policy "strategy_mapper_service_tiers_select_authenticated"
  on public.strategy_mapper_service_tiers
  for select to authenticated
  using (true);

create policy "strategy_mapper_service_tiers_insert_authenticated"
  on public.strategy_mapper_service_tiers
  for insert to authenticated
  with check (true);

create policy "strategy_mapper_service_tiers_update_authenticated"
  on public.strategy_mapper_service_tiers
  for update to authenticated
  using (true)
  with check (true);

create policy "strategy_mapper_service_tiers_delete_authenticated"
  on public.strategy_mapper_service_tiers
  for delete to authenticated
  using (true);

-- Seed baseline tiers (idempotent via tier_key)
insert into public.strategy_mapper_service_tiers
  (tier_key, service, tier_label, tier_rank, title, objective, tactics, match_aliases)
values
  (
    'seo-foundation',
    'seo',
    'SEO Foundation',
    1,
    'Search Engine Optimization (SEO) — Foundation',
    'Establish baseline digital visibility and search engine compliance for [Practice Name] to ensure local pet parents can accurately find your location, hours, and primary contact details on the web.',
    '[
      "Core Listing Verification: Claim, verify, and lock down the primary Google Business Profile (GBP) for [Practice Name] to prevent unauthorized edits and establish accurate NAP (Name, Address, Phone) tracking data.",
      "Essential Citation Alignment: Build out and sync baseline directory listings across foundational search ecosystems (Yelp, Apple Maps, Bing Places) to create uniform local search trust signals.",
      "Technical Health Pass: Configure essential Google Search Console and tracking profiles to monitor core site indexing and prevent structural web crawl errors."
    ]'::jsonb,
    array['SEO Local', 'SEO Foundation', 'Local SEO', 'Foundation SEO']
  ),
  (
    'seo-premium',
    'seo',
    'SEO Premium',
    2,
    'Search Engine Optimization (SEO) — Premium',
    'Drive high-intent local organic traffic to [Practice Name] by actively optimizing for everyday wellness and urgent care keywords within your tight [Local Core Radius] territory, outranking immediate neighborhood rivals.',
    '[
      "On-Page Keyword Mapping: Optimize all core website pages with geo-targeted title tags, header hierarchies, and meta descriptions specifically mapped to [Practice Type] keywords.",
      "Local Intent Content Engine: Deploy a monthly custom blog schedule tailored to seasonal veterinary health concerns and local trends unique to [Practice Location] to steadily scale your site''s organic search footprint.",
      "GBP Engagement Protocol: Maximize local map pack visibility by implementing active photo updates, attribute tuning, and localized post publishing directly within your Google Business Profile."
    ]'::jsonb,
    array['SEO Premium', 'Premium SEO', 'SEO Local Premium']
  ),
  (
    'seo-premium-plus',
    'seo',
    'SEO Premium Plus',
    3,
    'Search Engine Optimization (SEO) — Premium Plus',
    'Establish absolute market dominance across both your [Local Core Radius] for wellness care and an aggressive [Regional Radius] for high-ticket specialized services, capturing long-distance and referral-ready veterinary prospects before they choose corporate alternatives.',
    '[
      "Specialized Landing Page Ecosystem: Architect custom, hyper-optimized service landing pages engineered to rank for regional clinical keywords (e.g., advanced surgeries, diagnostics, specific therapies), capturing high-margin cases outside your immediate neighborhood.",
      "Topical Authority Content Strategy: Produce authoritative, deeply educational clinical articles that address complex patient conditions, exploiting content gaps left open by massive regional referral hospitals.",
      "AI Search & Answer Engine Optimization (AEO) Deployment: Build and embed token-optimized llms.txt and llms-full.txt files into the root directory of the new website. This architecture strips away script and code clutter, formatting [Practice Name]''s core identifiers, specialized clinical capabilities, and credentials into a clean, machine-readable format. This ensures that modern AI search engines and LLM web crawlers (such as ChatGPT, Claude, Perplexity, and Apple Intelligence) can instantly index and accurately cite the practice as the premier recommendation for local and regional pet parents."
    ]'::jsonb,
    array['SEO Premium Plus', 'Premium Plus SEO', 'SEO Premium+']
  ),
  (
    'ppc-premium',
    'ppc',
    'Ads Premium',
    1,
    'Pay-Per-Click Advertising (PPC) — Premium',
    'Capture immediate, bottom-of-funnel consumer intent within your local market, utilizing targeted paid search campaigns to fill open appointments and drive high-priority patient appointments directly to [Practice Name].',
    '[
      "Search Campaign Architecture: Build out structured Google Ads campaigns focused on high-intent terms like \"veterinarian near me\" and \"urgent vet care [City],\" isolating local ad spend to maximize conversion.",
      "Negative Keyword Defense: Implement rigid negative keyword lists to actively filter out irrelevant clicks, job seekers, and low-value searches, driving down your cost-per-acquisition.",
      "Conversion Asset Deployment: Direct paid traffic to highly targeted, fast-loading landing pages designed with single-action call extensions and form fillouts to maximize new client conversion rates."
    ]'::jsonb,
    array['Google Ads', 'PPC Premium', 'Ads Premium', 'Pay-Per-Click', 'PPC']
  ),
  (
    'ppc-premium-plus',
    'ppc',
    'Ads Premium Plus',
    2,
    'Pay-Per-Click Advertising (PPC) — Premium Plus',
    'Deploy an aggressive, multi-layered paid search and social advertising engine to capture high-ticket specialty procedures regionally while protecting and scaling your local wellness acquisition footprint.',
    '[
      "Dual-Radius Paid Segmentation: Segment budgets into distinct localized campaigns for day-to-day care and expansive regional campaigns optimized specifically to capture high-margin clinical caseloads from up to 50 miles away.",
      "Multi-Channel Social Integration: Layer in paid Meta (Facebook/Instagram) advertising assets to build top-of-mind brand awareness among pet-owning households, combining search intent with visual social audience targeting.",
      "A/B Performance Testing & Conversion Tracking: Utilize robust call-tracking analytics and continuous ad copy testing to isolate the highest-converting variants, scaling performance dynamically across your target geographic grid."
    ]'::jsonb,
    array['Ads Premium Plus', 'PPC Premium Plus', 'Google Ads Premium Plus']
  ),
  (
    'social-standard',
    'social',
    'Social Media Standard',
    1,
    'Social Media Marketing — Standard',
    'Maintain a professional, brand-accurate digital footprint across core social networks to ensure existing and prospective clients see an active, accessible veterinary practice.',
    '[
      "Branded Profile Optimization: Set up and visually align your Facebook and Instagram profiles with uniform imagery, contact rules, and brand voice syncs.",
      "Evergreen Content Cadence: Execute a consistent monthly social media calendar focusing on essential pet wellness tips, holiday care hazards, and foundational clinic operational alerts."
    ]'::jsonb,
    array['Social Media', 'Social Media Standard', 'SMM Standard', 'SMM']
  ),
  (
    'social-premium',
    'social',
    'Social Media Premium',
    2,
    'Social Media Marketing — Premium',
    'Humanize [Practice Name] and build an interactive local pet-community network that actively drives brand loyalty, positive word-of-mouth referrals, and emotional trust before a client ever steps foot in your lobby.',
    '[
      "Clinical Outcome Storytelling: Design a structured system to capture and publish inspiring patient success transformations and clinical outcomes (such as before-and-after recovery milestones), visibly proving your specialized care capabilities to a warm audience.",
      "Behind-The-Scenes Culture Spotlights: Produce authentic team features and medical park updates to showcase the human element of [Practice Name], lowering client barrier-to-trust for complex veterinary stays.",
      "Localized Growth & Engagement Mapping: Actively manage, monitor, and interact with community discussions, review comments, and platform messages to turn digital casual followers into lifelong, active clinic advocates."
    ]'::jsonb,
    array['Social Media Premium', 'SMM Premium', 'Social Premium']
  ),
  (
    'orm-foundation',
    'orm',
    'ORM Foundation',
    1,
    'Online Reputation Management (ORM) — Foundation',
    'TODO: Strategist to finalize — Establish baseline review velocity and GBP syndication for [Practice Name], transitioning from closed-loop platforms to public Google review growth in [Practice Location].',
    '[
      "TODO: Strategist to finalize — GBP review request workflow and baseline reputation monitoring.",
      "TODO: Strategist to finalize — Transition from closed-loop review platforms to public Google review syndication."
    ]'::jsonb,
    array['ORM Foundation', 'ORM Local', 'Reputation Management Foundation']
  ),
  (
    'orm-premium',
    'orm',
    'ORM Premium',
    2,
    'Online Reputation Management (ORM) — Premium',
    'TODO: Strategist to finalize — Accelerate public review velocity and competitive reputation positioning for [Practice Name] across [Local Core Radius], closing the gap against neighborhood rivals.',
    '[
      "TODO: Strategist to finalize — Active review generation protocol with staff accountability.",
      "TODO: Strategist to finalize — Competitive reputation gap analysis and response management."
    ]'::jsonb,
    array['ORM Premium', 'ORM Premium Plus', 'Reputation Management Premium', 'Review Management Premium']
  )
on conflict (tier_key) do nothing;
