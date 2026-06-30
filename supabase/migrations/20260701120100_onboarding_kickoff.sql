-- Quarterly Basecamp kickoff message: an admin-editable master template (standard
-- verbiage + per-service blocks) plus an optional per-client override. The app only
-- ever generates text for copy/paste — it never writes to Basecamp.

create table if not exists public.onboarding_kickoff_blocks (
  id bigint generated always as identity primary key,
  block_key text not null unique check (char_length(trim(block_key)) > 0),
  body text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_onboarding_kickoff (
  id bigint generated always as identity primary key,
  client_id bigint not null unique references public.clients(id) on delete cascade,
  custom_title text,
  custom_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.onboarding_kickoff_blocks to authenticated;
grant select, insert, update, delete on public.client_onboarding_kickoff to authenticated;

alter table public.onboarding_kickoff_blocks enable row level security;
alter table public.client_onboarding_kickoff enable row level security;

-- Master blocks: team-readable; edits go through an admin-gated API route (service role).
create policy "onboarding_kickoff_blocks_select_authenticated"
  on public.onboarding_kickoff_blocks for select to authenticated using (true);

-- Per-client overrides: team-shared, same as client_onboarding_items.
create policy "client_onboarding_kickoff_select_authenticated"
  on public.client_onboarding_kickoff for select to authenticated using (true);
create policy "client_onboarding_kickoff_insert_authenticated"
  on public.client_onboarding_kickoff for insert to authenticated with check (true);
create policy "client_onboarding_kickoff_update_authenticated"
  on public.client_onboarding_kickoff for update to authenticated using (true) with check (true);
create policy "client_onboarding_kickoff_delete_authenticated"
  on public.client_onboarding_kickoff for delete to authenticated using (true);

-- Default master copy. Merge fields: {{client_name}}, {{strategist}}, {{quarter_label}}.
insert into public.onboarding_kickoff_blocks (block_key, body, sort_order) values
  ('intro',
   'Hi {{client_name}} team,

Welcome aboard — we''re excited to partner with you. I''m {{strategist}}, your dedicated marketing strategist and main point of contact here in Basecamp. This thread is home base for {{quarter_label}} — updates, questions, approvals, and reporting all in one place.

Here''s what we''re putting in motion for you this quarter:',
   10),
  ('svc_seo',
   '📈 Search Engine Optimization (SEO)
• Full technical audit of your site to clear anything holding back rankings
• Local keyword targeting for pet owners in your area
• On-page optimization of your priority service pages
• Google Business Profile optimization and ongoing local SEO
• Monthly reporting on rankings, traffic, and visibility',
   20),
  ('svc_ppc',
   '🎯 Paid Search – Google Ads (PPC)
• Campaign audit/restructure for efficiency and conversion tracking
• Ongoing bid, budget, and keyword management
• Competitor and wasted-spend monitoring
• Monthly performance reporting',
   30),
  ('svc_smm',
   '📱 Social Media Marketing (SMM)
• Branded content calendar tailored to your practice
• Regular posting across your active platforms
• Community engagement and message monitoring',
   40),
  ('svc_blog',
   '✍️ Blog & Content
• Veterinary-focused, SEO-aligned articles written for pet owners
• A content schedule mapped to your services and seasons
• Publishing and internal linking to support your SEO',
   50),
  ('svc_orm',
   '⭐ Online Reputation Management (ORM)
• Review monitoring across Google and key directories
• Response support to protect and grow your star rating
• Strategies to generate more positive reviews',
   60),
  ('closing',
   'Over the next couple of weeks we''ll get all your accounts connected and baseline measurements in place. You don''t need to do anything but keep an eye on this thread — we''ll clearly flag any time we need something from you.

Excited to get started!
{{strategist}} · Beyond Indigo Pets',
   70)
on conflict (block_key) do nothing;
