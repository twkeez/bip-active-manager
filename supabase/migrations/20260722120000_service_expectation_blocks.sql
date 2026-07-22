-- Client-expectations content: an admin-editable master template of per-service
-- expectation blurbs (what to expect / what we need from you / our recommendations)
-- plus a shared intro, overall timetable, and closing. Service defaults only — the
-- same copy is used for every client with that service; there is no per-client
-- override. The app assembles a client's ACTIVE services into a branded pre-kickoff
-- document (PDF + Word). Merge fields: {{client_name}}, {{strategist}}.

create table if not exists public.service_expectation_blocks (
  id bigint generated always as identity primary key,
  block_key text not null unique check (char_length(trim(block_key)) > 0),
  body text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.service_expectation_blocks to authenticated;

alter table public.service_expectation_blocks enable row level security;

-- Team-readable; edits go through an admin-gated API route (service role).
create policy "service_expectation_blocks_select_authenticated"
  on public.service_expectation_blocks for select to authenticated using (true);

-- Default master copy. Merge fields: {{client_name}}, {{strategist}}.
insert into public.service_expectation_blocks (block_key, body, sort_order) values
  ('intro',
   'Welcome to Beyond Indigo, {{client_name}}! We''re thrilled to partner with you. This document lays out what to expect over your first 90 days, the handful of things we''ll need from you to hit the ground running, and our recommendations for getting the most out of each service. Your strategist, {{strategist}}, will walk through all of this with you at kickoff.',
   10),
  ('timetable',
   'Weeks 1–2 — Onboarding & access: we connect your accounts, set up tracking, and establish baseline measurements.
Weeks 2–4 — Foundations: audits, keyword research, campaign builds, and content planning get underway.
Month 2 — Execution: optimizations, publishing, and campaigns are live and actively managed.
Month 3 — Momentum & first full report: you receive your first complete performance report and we refine based on early data.',
   20),
  ('seo_expect',
   'SEO is a compounding investment. Expect meaningful movement in local search within about 3–6 months as we clear technical issues, optimize your priority pages, and strengthen your Google Business Profile. Early weeks focus on foundations that pay off over time.',
   100),
  ('seo_need',
   '• Access to your Google Business Profile and Google Search Console
• Admin access to your website (or your web developer''s contact)
• A list of your most important services and locations',
   101),
  ('seo_recommend',
   'We recommend prioritizing the service pages that drive the most revenue, keeping your Google Business Profile hours and details current, and letting us guide any website changes so we don''t lose ranking signals.',
   102),
  ('ppc_expect',
   'Google Ads typically shows impact within the first few weeks. After an initial learning period, expect a steady flow of calls and bookings as we refine bids, budgets, and targeting around your best-converting services.',
   110),
  ('ppc_need',
   '• Billing details added to the Google Ads account we create for you
• Confirmation of your service areas and any promotions to feature
• A phone number and/or booking link you want the ads to drive to',
   111),
  ('ppc_recommend',
   'We recommend starting with a focused budget on your highest-value services, enabling call tracking so we can prove ROI, and giving campaigns a few weeks to optimize before judging results.',
   112),
  ('smm_expect',
   'Social builds brand familiarity and trust over time. Expect consistent, on-brand posting across your active platforms within the first few weeks, with engagement and following growing steadily month over month.',
   120),
  ('smm_need',
   '• Access to your Facebook & Instagram (we''ll send a short walkthrough)
• Your brand assets — logo, photos, and any brand guidelines
• A heads-up on any events, promotions, or news worth posting',
   121),
  ('smm_recommend',
   'We recommend sharing real photos of your team and patients (with permission), letting us maintain a consistent posting cadence, and routing any direct messages that need a clinical answer back to your staff.',
   122),
  ('blog_expect',
   'Blog content supports your SEO and answers the questions pet owners are searching for. Expect regularly published, veterinary-focused articles on a schedule, building a library that draws in local search traffic over time.',
   130),
  ('blog_need',
   '• Any topics, services, or seasonal themes you want prioritized
• Review/approval of drafts when requested (we keep this light)
• A subject-matter contact for anything clinically sensitive',
   131),
  ('blog_recommend',
   'We recommend starting with proven local topics, letting us handle SEO structure and internal linking, and flagging any medical claims you want reviewed before publishing.',
   132),
  ('orm_expect',
   'Reputation management protects and grows your star rating. Expect monitoring of reviews across Google and key directories, response support, and strategies to steadily generate more positive reviews.',
   140),
  ('orm_need',
   '• Access to your Google Business Profile
• Your preferred tone for review responses
• Buy-in from front-desk staff to ask happy clients for reviews',
   141),
  ('orm_recommend',
   'We recommend responding to every review (we''ll help), building a simple habit of asking satisfied clients to leave feedback, and treating negative reviews as a chance to show your care publicly.',
   142),
  ('closing',
   'That''s the plan for your first 90 days. We''ll clearly flag anytime we need something from you — otherwise you can sit back while we get everything in motion. We''re looking forward to kickoff!

{{strategist}} · Beyond Indigo Pets',
   900)
on conflict (block_key) do nothing;
