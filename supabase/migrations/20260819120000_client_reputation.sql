-- Client reputation: Google review corpus per client, plus the generated
-- brand analysis built from it.
--
-- Reviews are stored rather than fetched on demand for three reasons: the
-- DataForSEO reviews endpoint is task-based and slow (~60s even on priority),
-- review text barely changes so refetching is waste, and storing lets us
-- regenerate the analysis with a better prompt without paying for the data
-- again. Safe to run once against an existing database.

-- ── 1. client_reputation_snapshots ───────────────────────────────────────────
-- Profile-level stats from business_data/google/my_business_info (live, ~0.5c).
-- One row per fetch so rating movement over time is visible.

create table if not exists public.client_reputation_snapshots (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  place_id text null,
  title text null,
  rating numeric(2,1) null,
  votes_count integer null,
  -- {"1": 2, "2": 0, "3": 1, "4": 3, "5": 124}
  rating_distribution jsonb not null default '{}'::jsonb,
  -- Google's own auto-extracted review topics with mention counts:
  -- {"quick appointments": 8, "welcoming atmosphere": 7, ...}
  place_topics jsonb not null default '{}'::jsonb,
  address text null,
  city text null,
  region text null
);

comment on table public.client_reputation_snapshots is
  'Google Business Profile stats per client per fetch. place_topics is Google''s own review topic extraction, not ours.';

create index if not exists client_reputation_snapshots_client_idx
  on public.client_reputation_snapshots (client_id, fetched_at desc);

alter table public.client_reputation_snapshots enable row level security;
drop policy if exists "auth_read_client_reputation_snapshots" on public.client_reputation_snapshots;
create policy "auth_read_client_reputation_snapshots" on public.client_reputation_snapshots
  for select to authenticated using (true);

-- ── 2. client_reviews ────────────────────────────────────────────────────────
-- Individual Google reviews. review_id is Google's, so re-fetching upserts
-- rather than duplicating, and new-since-last-run is a simple date filter.

create table if not exists public.client_reviews (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  review_id text not null,
  rating integer null check (rating is null or rating between 1 and 5),
  review_text text null,
  profile_name text null,
  reviewed_at timestamptz null,
  owner_answer text null,
  local_guide boolean not null default false,
  fetched_at timestamptz not null default now(),
  unique (client_id, review_id)
);

comment on column public.client_reviews.review_text is
  'Null/empty for rating-only reviews — roughly a fifth of a typical corpus. Analysis must filter these out.';

create index if not exists client_reviews_client_date_idx
  on public.client_reviews (client_id, reviewed_at desc);

alter table public.client_reviews enable row level security;
drop policy if exists "auth_read_client_reviews" on public.client_reviews;
create policy "auth_read_client_reviews" on public.client_reviews
  for select to authenticated using (true);

-- ── 3. client_reputation_reports ─────────────────────────────────────────────
-- The generated analysis. Kept as history rather than overwritten so a prompt
-- change that makes things worse is recoverable.

create table if not exists public.client_reputation_reports (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  generated_at timestamptz not null default now(),
  generated_by text null,
  model text null,
  review_count integer not null default 0,
  report_markdown text not null
);

create index if not exists client_reputation_reports_client_idx
  on public.client_reputation_reports (client_id, generated_at desc);

alter table public.client_reputation_reports enable row level security;
drop policy if exists "auth_read_client_reputation_reports" on public.client_reputation_reports;
create policy "auth_read_client_reputation_reports" on public.client_reputation_reports
  for select to authenticated using (true);
