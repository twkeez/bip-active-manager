-- Maps Rank Tracker: a client's Google Maps rank for a few searches, re-checked
-- on a schedule from the same points every time (a fixed town point, and a grid
-- around the practice), so a report can show movement against a baseline and a
-- goal. One tracker per client; one row per run.
--
-- Server-only: row-level security on with no policies.

create table if not exists public.maps_rank_trackers (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  created_by text,
  client_id bigint references public.clients(id) on delete set null,
  practice_name text not null,
  place_id text not null,
  domain text,
  latitude double precision not null,
  longitude double precision not null,
  town_label text not null,
  town_latitude double precision not null,
  town_longitude double precision not null,
  radius_miles numeric(4, 1) not null default 3,
  searches jsonb not null default '[]'::jsonb,
  goal_date date,
  every_days integer not null default 14,
  active boolean not null default true,
  drive_folder_url text
);

create table if not exists public.maps_rank_runs (
  id bigint generated always as identity primary key,
  tracker_id bigint not null references public.maps_rank_trackers(id) on delete cascade,
  ran_at timestamptz not null default now(),
  status text not null check (status in ('complete', 'partial', 'failed')),
  results jsonb not null default '{}'::jsonb,
  cost_usd numeric(10, 4) not null default 0,
  error text,
  doc_url text
);

create index if not exists maps_rank_runs_tracker_idx on public.maps_rank_runs (tracker_id, ran_at desc);

alter table public.maps_rank_trackers enable row level security;
alter table public.maps_rank_runs enable row level security;
