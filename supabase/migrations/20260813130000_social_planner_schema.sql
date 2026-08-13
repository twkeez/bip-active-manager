-- Social planner schema: per-client + purpose-tagged ideas, series (recurring
-- and multi-part arcs), a real awareness-day table with date rules, provenance
-- links on posts, and a photo-list backlog.
--
-- Safe to run once against an existing database. The 15 seeded rows in
-- social_idea_repository are left untouched (new columns are nullable or
-- defaulted).

-- ── 1. social_idea_repository: client scoping + purpose axis + provenance ────

alter table public.social_idea_repository
  add column if not exists client_id bigint null references public.clients(id) on delete cascade,
  add column if not exists purpose text null,
  add column if not exists source text not null default 'manual';

comment on column public.social_idea_repository.client_id is
  'NULL = global idea suggested for every client; set = specific to that client.';
comment on column public.social_idea_repository.purpose is
  'The GOAL of the post. Second axis alongside campaign_type, which is the FORMAT.';
comment on column public.social_idea_repository.source is
  'manual | ai_saved | seed — where the row came from.';

-- Existing 15 rows predate this column and were shipped as seeds.
update public.social_idea_repository
   set source = 'seed'
 where source = 'manual'
   and created_by is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'social_idea_repository_purpose_check') then
    alter table public.social_idea_repository
      add constraint social_idea_repository_purpose_check
      check (purpose is null or purpose in
        ('services','fun','engagement','educational','promotional','community'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'social_idea_repository_source_check') then
    alter table public.social_idea_repository
      add constraint social_idea_repository_source_check
      check (source in ('manual','ai_saved','seed'));
  end if;
end $$;

create index if not exists social_idea_repository_client_active_idx
  on public.social_idea_repository (client_id, is_active);

-- ── 2. social_series ─────────────────────────────────────────────────────────

create table if not exists public.social_series (
  id bigint generated always as identity primary key,
  client_id bigint null references public.clients(id) on delete cascade,
  title text not null,
  description text not null,
  kind text not null check (kind in ('recurring','arc')),
  campaign_type text not null,
  purpose text null check (purpose is null or purpose in
    ('services','fun','engagement','educational','promotional','community')),
  tags text[] not null default '{}',
  -- recurring only
  cadence text null check (cadence is null or cadence in ('weekly','biweekly','monthly')),
  day_of_week smallint null check (day_of_week is null or day_of_week between 0 and 6),
  -- arc only
  spacing_days smallint null check (spacing_days is null or spacing_days > 0),
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_series_kind_fields_check check (
    (kind = 'recurring' and cadence is not null and spacing_days is null)
    or
    (kind = 'arc' and spacing_days is not null and cadence is null and day_of_week is null)
  )
);

comment on table public.social_series is
  'Two kinds: recurring (a slot that repeats on a cadence) and arc (an ordered, finite story told in parts).';
comment on column public.social_series.client_id is 'NULL = global series available to every client.';

create index if not exists social_series_client_active_idx
  on public.social_series (client_id, is_active);

alter table public.social_series enable row level security;
drop policy if exists "auth_read_social_series" on public.social_series;
create policy "auth_read_social_series" on public.social_series
  for select to authenticated using (true);

-- ── 3. social_series_parts (arc series only) ─────────────────────────────────

create table if not exists public.social_series_parts (
  id bigint generated always as identity primary key,
  series_id bigint not null references public.social_series(id) on delete cascade,
  part_number smallint not null check (part_number > 0),
  title text not null,
  description text not null,
  suggested_shot text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_series_parts_unique unique (series_id, part_number)
);

create index if not exists social_series_parts_series_idx
  on public.social_series_parts (series_id, part_number);

alter table public.social_series_parts enable row level security;
drop policy if exists "auth_read_social_series_parts" on public.social_series_parts;
create policy "auth_read_social_series_parts" on public.social_series_parts
  for select to authenticated using (true);

-- ── 4. social_awareness_days ─────────────────────────────────────────────────

create table if not exists public.social_awareness_days (
  id bigint generated always as identity primary key,
  name text not null,
  description text not null,
  content_angle text not null,
  rule_type text not null check (rule_type in ('fixed','nth_weekday','week_of','month_long')),
  month smallint not null check (month between 1 and 12),
  day smallint null check (day is null or day between 1 and 31),
  nth smallint null check (nth is null or (nth between 1 and 5) or nth = -1),
  weekday smallint null check (weekday is null or weekday between 0 and 6),
  week_start_day smallint null check (week_start_day is null or week_start_day between 1 and 31),
  duration_days smallint null check (duration_days is null or duration_days > 0),
  series_id bigint null references public.social_series(id) on delete set null,
  verified boolean not null default false,
  source_url text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_awareness_days_name_month_unique unique (name, month),
  -- Each rule_type carries exactly the fields it needs and no others.
  constraint social_awareness_days_rule_fields_check check (
    (rule_type = 'fixed' and day is not null
       and nth is null and weekday is null and week_start_day is null and duration_days is null)
    or
    (rule_type = 'nth_weekday' and nth is not null and weekday is not null
       and day is null and week_start_day is null and duration_days is null)
    or
    -- week_of has two forms: a fixed start day, or an nth-weekday start.
    (rule_type = 'week_of' and duration_days is not null and day is null
       and (
         (week_start_day is not null and nth is null and weekday is null)
         or
         (week_start_day is null and nth is not null and weekday is not null)
       ))
    or
    (rule_type = 'month_long'
       and day is null and nth is null and weekday is null
       and week_start_day is null and duration_days is null)
  )
);

comment on column public.social_awareness_days.nth is
  '1..5 = that occurrence in the month; -1 = the last occurrence.';
comment on column public.social_awareness_days.weekday is '0=Sunday .. 6=Saturday.';
comment on column public.social_awareness_days.week_start_day is
  'week_of, fixed-start form: the day of month the week begins on.';
comment on column public.social_awareness_days.verified is
  'False until a human has confirmed the date rule against a real source.';

create index if not exists social_awareness_days_month_idx
  on public.social_awareness_days (month, is_active);

alter table public.social_awareness_days enable row level security;
drop policy if exists "auth_read_social_awareness_days" on public.social_awareness_days;
create policy "auth_read_social_awareness_days" on public.social_awareness_days
  for select to authenticated using (true);

-- Port of the hardcoded AWARENESS_DAYS array (lib/social/awareness-days.ts).
-- These are AI-generated with no provenance, so they land as a REVIEW BACKLOG:
-- verified=false, source_url=null, is_active=false. Nothing surfaces in the UI
-- until a human checks the date rule and flips is_active.
-- Entries that were whole-month (day: null) become 'month_long'; the rest
-- become 'fixed'. Several are really 'week_of' (e.g. "National Pet Poison
-- Prevention Week") and should be corrected to that rule during review.
insert into public.social_awareness_days
  (name, description, content_angle, rule_type, month, day)
values
  ('National Train Your Dog Month', 'Whole month celebrating dog training', 'Share a quick training tip or highlight the importance of regular obedience work', 'month_long', 1, null),
  ('National Bird Day', 'Awareness day for pet birds and avian welfare', 'Feature any avian patients or share care tips for bird owners', 'fixed', 1, 5),
  ('National Walk Your Dog Week', 'First week of January — encourages daily dog walking', 'Motivate clients to start the year with a walking routine and why it matters for pet health', 'month_long', 1, null),
  ('National Pet Dental Health Month', 'Whole month focused on pet oral health', 'Share dental stats, before/after visuals (with permission), or a quick brushing demo video', 'month_long', 2, null),
  ('Valentine''s Day Pet Safety', 'Valentine''s Day — chocolate and lilies are hazards for pets', 'Warm love-themed post with a safety reminder about holiday hazards (chocolate, flowers)', 'fixed', 2, 14),
  ('Spay/Neuter Awareness Month', 'Whole month promoting spay and neuter', 'Share the health and population benefits of spay/neuter in an approachable way', 'month_long', 2, null),
  ('National Puppy Day', 'Celebrates puppies and promotes adoption', 'Feature a cute puppy patient or share new puppy tips — vaccines, socialization, first vet visit', 'fixed', 3, 23),
  ('National Pet Poison Prevention Week', 'Third week of March — common household toxins', 'Share a list of common household items that are toxic to pets — always high engagement', 'month_long', 3, null),
  ('St. Patrick''s Day Pet Safety', 'Holiday safety for pets', 'Fun green-themed post with a gentle reminder about alcohol and onion/garlic dangers', 'fixed', 3, 17),
  ('National Pet Day', 'Celebrates the joy pets bring to our lives', 'Ask followers to share a photo of their pet — great for comments and engagement', 'fixed', 4, 11),
  ('World Veterinary Day', 'Last Saturday in April — honors veterinary professionals worldwide', 'Celebrate the team! Group photo, individual spotlights, or thank-you post from the practice', 'month_long', 4, null),
  ('Prevention of Cruelty to Animals Month', 'ASPCA''s awareness month', 'Highlight the practice''s commitment to animal welfare or partner with a local shelter', 'month_long', 4, null),
  ('National Pet Month', 'US celebration of the human-animal bond', 'Feature heartwarming client stories or showcase the range of species the practice sees', 'month_long', 5, null),
  ('National Rescue Dog Day', 'Celebrates dogs rescued from shelters', 'Feature team members'' rescue pets or share a rescue patient success story', 'fixed', 5, 20),
  ('Chip Your Pet Month', 'Promotes microchipping for pet identification', 'Reminder post on why microchipping matters with a simple call-to-action to book the service', 'month_long', 5, null),
  ('National Microchipping Month', 'Dedicated month for microchip awareness', 'Share a reunited-with-owner story or explain how microchipping works in simple terms', 'month_long', 6, null),
  ('Adopt a Shelter Cat Month', 'Encourages cat adoption from shelters', 'Feature feline patients, share cat care tips, or partner with a local rescue', 'month_long', 6, null),
  ('National Pet Preparedness Month', 'Disaster preparedness for pet owners', 'Share a simple emergency kit checklist for pet owners — highly shareable practical content', 'month_long', 6, null),
  ('4th of July Pet Safety', 'Fireworks are highly stressful and dangerous for pets', 'Pre-holiday safety post: firework anxiety, ID tags, keeping pets indoors — always gets engagement', 'fixed', 7, 4),
  ('National Dog Photography Month', 'Celebrates pet photography', 'Share tips for getting a great photo of your dog at home — and ask clients to share their best shots', 'month_long', 7, null),
  ('National Lost Pet Prevention Month', 'Focuses on keeping pets safe and identified', 'Microchip reminder, ID tag check, and tips for keeping pets safely contained during summer', 'month_long', 7, null),
  ('International Cat Day', 'Global celebration of cats', 'Feature feline patients or share surprising cat health facts — great engagement day', 'fixed', 8, 8),
  ('National Check the Chip Day', 'Encourages pet owners to verify microchip registration', 'Reminder to check that microchip info is current — simple, actionable, easy to share', 'fixed', 8, 15),
  ('National Dog Day', 'Celebrates dogs and encourages adoption', 'Feature dog patients, ask followers to tag their dogs, or highlight canine care tips', 'fixed', 8, 26),
  ('National Responsible Dog Ownership Month', 'AKC month promoting responsible dog ownership', 'Share the pillars of responsible ownership: vet visits, training, nutrition, socialization', 'month_long', 9, null),
  ('Happy Cat Month', 'CFA''s month dedicated to feline health and happiness', 'Environmental enrichment tips, indoor cat wellness, or feature a senior cat patient', 'month_long', 9, null),
  ('Animal Pain Awareness Month', 'IVAPM awareness month for animal pain recognition', 'Educational post on subtle signs of pain in pets — a hugely valuable and shareable topic', 'month_long', 9, null),
  ('Adopt a Shelter Dog Month', 'ASPCA month encouraging dog adoption', 'Feature adopted patients or share the joys and tips of welcoming a rescue dog', 'month_long', 10, null),
  ('Pet Obesity Awareness Day', 'Second Wednesday of October', 'Share the risks of pet obesity and practical tips for healthy weight — pair with a body condition score visual', 'month_long', 10, null),
  ('Halloween Pet Safety', 'Candy and costumes pose hazards to pets', 'Pre-Halloween safety post: xylitol in candy, costume safety, keeping pets calm — always gets shares', 'fixed', 10, 31),
  ('National Cat Day', 'Celebrates cats and promotes adoption', 'Feature feline patients, fun cat facts, or ask followers to share their cats', 'fixed', 10, 29),
  ('Adopt a Senior Pet Month', 'ASPCA month dedicated to senior pet adoption', 'Feature a senior patient or highlight the rewards of adopting an older pet — deeply emotional content', 'month_long', 11, null),
  ('National Animal Shelter Appreciation Week', 'First full week of November', 'Thank local shelter staff or share how the practice supports the rescue community', 'month_long', 11, null),
  ('Thanksgiving Pet Safety', 'Thanksgiving food hazards for pets', 'Pre-holiday post on foods to keep away from pets — turkey bones, grapes, onions, xylitol', 'month_long', 11, null),
  ('National Cat Lovers Month', 'Whole month celebrating cats', 'Feature a feline patient each week or share a month-long series of cat care tips', 'month_long', 12, null),
  ('Holiday Pet Safety Month', 'Whole month — holiday hazards for pets', 'Decorations (tinsel, poinsettias), holiday food risks, travel tips — spread across multiple posts', 'month_long', 12, null),
  ('New Year''s Eve Pet Safety', 'Fireworks and celebrations can be stressful for pets', 'End-of-year post on helping pets through fireworks — links naturally to a January fresh-start post', 'fixed', 12, 31)
on conflict (name, month) do nothing;

-- ── 5. Provenance links on posts ─────────────────────────────────────────────
-- (locked already exists from 20260813120000_social_post_locked.sql)

alter table public.social_content_posts
  add column if not exists idea_id bigint null references public.social_idea_repository(id) on delete set null,
  add column if not exists series_id bigint null references public.social_series(id) on delete set null,
  add column if not exists series_part smallint null,
  add column if not exists awareness_day_id bigint null references public.social_awareness_days(id) on delete set null;

create index if not exists social_content_posts_series_idx
  on public.social_content_posts (series_id, series_part);

-- ── 6. social_photo_list_items ───────────────────────────────────────────────

create table if not exists public.social_photo_list_items (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.social_content_plans(id) on delete cascade,
  post_id bigint null references public.social_content_posts(id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.social_photo_list_items is
  'The month photo brief. post_id NULL = a standalone ask not tied to a post.';
comment on column public.social_photo_list_items.body is
  'Mirrors social_content_posts.shot_list (a single text string, not an array) when post_id is set — edits here must be written back to the post.';

create index if not exists social_photo_list_items_plan_idx
  on public.social_photo_list_items (plan_id, sort_order);
create index if not exists social_photo_list_items_post_idx
  on public.social_photo_list_items (post_id);

alter table public.social_photo_list_items enable row level security;
drop policy if exists "auth_read_social_photo_list_items" on public.social_photo_list_items;
create policy "auth_read_social_photo_list_items" on public.social_photo_list_items
  for select to authenticated using (true);
