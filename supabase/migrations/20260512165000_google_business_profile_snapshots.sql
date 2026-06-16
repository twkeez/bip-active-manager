create table if not exists public.client_gbp_snapshots (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  place_id text not null,
  place_name text,
  profile_url text,
  website_url text,
  address text,
  rating numeric(3,2),
  user_ratings_total integer,
  run_status text not null check (run_status in ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_gbp_snapshots_client_created
  on public.client_gbp_snapshots (client_id, created_at desc);

create table if not exists public.client_gbp_reviews (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  snapshot_id bigint not null references public.client_gbp_snapshots(id) on delete cascade,
  author_name text,
  rating integer,
  text text,
  relative_time_description text,
  review_time_unix bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_gbp_reviews_client_created
  on public.client_gbp_reviews (client_id, created_at desc);

grant select on public.client_gbp_snapshots to authenticated;
grant select on public.client_gbp_reviews to authenticated;

alter table public.client_gbp_snapshots enable row level security;
alter table public.client_gbp_reviews enable row level security;

drop policy if exists "client_gbp_snapshots_select_authenticated" on public.client_gbp_snapshots;
create policy "client_gbp_snapshots_select_authenticated"
  on public.client_gbp_snapshots
  for select
  to authenticated
  using (true);

drop policy if exists "client_gbp_reviews_select_authenticated" on public.client_gbp_reviews;
create policy "client_gbp_reviews_select_authenticated"
  on public.client_gbp_reviews
  for select
  to authenticated
  using (true);
