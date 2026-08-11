-- Social Content Planner: idea repository, client profiles, plans, posts

create table public.social_idea_repository (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null,
  campaign_type text not null,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_idea_repository enable row level security;
create policy "auth_read_social_ideas" on public.social_idea_repository
  for select to authenticated using (true);

create table public.social_client_profiles (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  specialty text,
  tone text,
  notes text,
  standing_campaigns jsonb not null default '[]'::jsonb,
  posts_per_week integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_client_profiles_client_id_key unique (client_id)
);
alter table public.social_client_profiles enable row level security;
create policy "auth_read_social_profiles" on public.social_client_profiles
  for select to authenticated using (true);

create table public.social_content_plans (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  plan_month integer not null check (plan_month between 1 and 12),
  plan_year integer not null check (plan_year >= 2020),
  status text not null default 'draft',
  campaign_types_used text[] not null default '{}',
  awareness_days_used text[] not null default '{}',
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_content_plans_unique unique (client_id, plan_month, plan_year)
);
alter table public.social_content_plans enable row level security;
create policy "auth_read_social_plans" on public.social_content_plans
  for select to authenticated using (true);

create table public.social_content_posts (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.social_content_plans(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  post_date date not null,
  platform text not null default 'both',
  campaign_type text not null,
  campaign_label text not null,
  caption_draft text,
  shot_list text,
  hashtags text,
  status text not null default 'idea',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_content_posts enable row level security;
create policy "auth_read_social_posts" on public.social_content_posts
  for select to authenticated using (true);

-- Starter idea seeds
insert into public.social_idea_repository (title, description, campaign_type, tags) values
  ('Pet of the Month', 'Feature a client''s pet as Patient of the Month. Ask the client to submit a favorite photo with the pet''s name and a fun fact about them.', 'pet_of_month', ARRAY['recurring', 'client-submitted']),
  ('Staff Pet Feature', 'A team member shares their own pet — photo, name, and a fun fact. Rotates through the whole team across months.', 'team_spotlight', ARRAY['team', 'recurring']),
  ('Meet the Vet', 'Spotlight one veterinarian or vet tech — headshot or candid photo, their specialty, years with the practice, and something personal (their own pet, favorite breed, etc.).', 'team_spotlight', ARRAY['team', 'recurring']),
  ('Myth vs. Fact', 'Pick a common pet health misconception and bust it with a clear fact. Great for education and shareability. Example: "Myth: Indoor cats don''t need vet visits. Fact: ..."', 'educational', ARRAY['educational', 'engagement']),
  ('Resident / Mascot Pet', 'If the practice has a house pet or mascot, run a recurring series from their "perspective" — short diary-style captions with a candid photo.', 'resident_pet', ARRAY['series', 'fun']),
  ('Before & After: Dental', 'With client permission, share a dental cleaning before-and-after. Reinforces the value of dental health and the team''s skill.', 'before_after', ARRAY['dental', 'educational']),
  ('Fun Fact Friday', 'Post a surprising or heartwarming fact about pet health, animal behavior, or the vet world. Short and punchy — made to be shared.', 'fun_fact', ARRAY['educational', 'recurring']),
  ('Behind the Scenes: Morning Rounds', 'A short video or candid photo of the team starting the day — patients arriving, morning check-ins, busy hallways. Shows the human side of the practice.', 'behind_scenes', ARRAY['video', 'team']),
  ('Client Testimonial + Pet Photo', 'Pair a Google review quote with the client''s pet photo. Ask the client to submit a photo or pull from an existing review. Warm and trust-building.', 'client_testimonial', ARRAY['social-proof', 'client-submitted']),
  ('Seasonal Pet Safety Tips', 'Timely safety reminders tied to the season — holiday food hazards, summer heat safety, flea/tick season, winter paw care. Always timely and shareable.', 'seasonal', ARRAY['educational', 'seasonal']),
  ('New Baby + Pet Introduction', 'Tips for introducing a new baby or child to a family pet — a perennially popular topic with broad appeal beyond existing clients.', 'educational', ARRAY['educational', 'broad-appeal']),
  ('Senior Pet Spotlight', 'Feature an older patient or highlight the unique needs of senior pets. Heartwarming and underserved content category.', 'pet_of_month', ARRAY['senior-pets', 'emotional']),
  ('Breed Spotlight', 'Feature a specific breed the practice sees frequently — personality traits, common health considerations, fun facts. Good for SEO too.', 'educational', ARRAY['educational', 'breed-specific']),
  ('Staff Shoutout', 'Celebrate a team member''s work anniversary, birthday, certification, or milestone. Humanizes the practice and boosts team morale.', 'team_spotlight', ARRAY['team', 'milestone']),
  ('New Service or Equipment', 'Announce a new service, procedure, or piece of equipment — with a photo of the team using it. Positions the practice as cutting-edge.', 'promotion', ARRAY['announcement', 'educational']);
