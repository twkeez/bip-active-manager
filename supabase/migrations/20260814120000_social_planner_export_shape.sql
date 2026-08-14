-- Reshape the social planner around the sheet the SMM team actually receives.
--
-- The agency's real handoff is a CSV with exactly five columns:
--   Date, Content Pillar, Headline, Subheadline, Photo Suggestion
-- so posts now carry those fields directly instead of a long AI caption plus a
-- shot list and hashtags.
--
-- caption_draft / shot_list / hashtags are deliberately NOT dropped: 50 posts
-- carry written captions and destroying them would be irreversible. They simply
-- stop being read, written, or exported. Drop them in a later migration once
-- the new shape has been in use for a while.

-- ── Posts ────────────────────────────────────────────────────────────────────

alter table public.social_content_posts
  add column if not exists content_pillar   text,
  add column if not exists headline         text,
  add column if not exists subheadline      text,
  add column if not exists photo_suggestion text;

comment on column public.social_content_posts.content_pillar is
  'Educational, Educational/Reassuring, Awareness/Engagement, Awareness/Educational, Attract/Engagement, Build Trust, Convert, Community.';
comment on column public.social_content_posts.caption_draft is
  'DEPRECATED — superseded by headline/subheadline. Retained so existing drafts are not lost.';

-- Seed the new fields from what is already there so the 50 live posts are not
-- blank on first load. The caption's first sentence is a reasonable headline
-- stand-in; the shot list is exactly what photo_suggestion means.
update public.social_content_posts
set
  headline = coalesce(
    headline,
    nullif(trim(split_part(regexp_replace(coalesce(caption_draft, ''), '\s+', ' ', 'g'), '.', 1)), '')
  ),
  photo_suggestion = coalesce(photo_suggestion, nullif(trim(coalesce(shot_list, '')), ''))
where headline is null or photo_suggestion is null;

-- ── Idea repository ──────────────────────────────────────────────────────────
-- Ideas now carry the defaults an editor pre-fills with.

alter table public.social_idea_repository
  add column if not exists category                 text,
  add column if not exists default_pillar           text,
  add column if not exists default_subheadline      text,
  add column if not exists default_photo_suggestion text;

comment on column public.social_idea_repository.category is
  'Services, Fun, Engagement, Blog, Educational, Promotional, Community.';

-- ── Seasonal verification ────────────────────────────────────────────────────
-- Awareness/seasonal dates shift year to year, so a month's list stays hidden
-- until someone confirms that year's dates. One row per (year, month) once
-- verified; absence means unverified.

create table if not exists public.social_awareness_verifications (
  id          bigint generated always as identity primary key,
  year        integer not null check (year between 2000 and 2100),
  month       integer not null check (month between 1 and 12),
  verified_at timestamptz not null default now(),
  verified_by text,
  unique (year, month)
);

alter table public.social_awareness_verifications enable row level security;

drop policy if exists "read awareness verifications" on public.social_awareness_verifications;
create policy "read awareness verifications"
  on public.social_awareness_verifications
  for select
  to authenticated
  using (true);

-- October 2026 was verified by hand against the seeded rows, so record it.
insert into public.social_awareness_verifications (year, month, verified_by)
values (2026, 10, 'seeded from verified October list')
on conflict (year, month) do nothing;
