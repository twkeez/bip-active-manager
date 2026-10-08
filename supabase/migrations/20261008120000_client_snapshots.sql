-- Monthly Snapshot, step 2: what clients see, and how they get to it.
--
-- A client never sees live data. An admin previews the snapshot in BIP
-- Control and publishes it; the published copy is frozen here, so what the
-- client sees is exactly what we checked (including that the "What we did"
-- posts are fit for them), and a half-finished nightly sync can never show
-- through. Their private link shows the latest published copy.
--
-- Links are long random tokens stored only as SHA-256 hashes, revocable, and
-- counted when viewed. Server only: RLS on, no policies, nothing granted to
-- the browser roles.

create table if not exists public.client_snapshot_publications (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  published_by_email text not null
);
create index if not exists client_snapshot_publications_latest on public.client_snapshot_publications (client_id, published_at desc);

create table if not exists public.client_snapshot_links (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  created_by_email text not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0
);
create index if not exists client_snapshot_links_client on public.client_snapshot_links (client_id);

alter table public.client_snapshot_publications enable row level security;
alter table public.client_snapshot_links enable row level security;
revoke all on public.client_snapshot_publications, public.client_snapshot_links from anon, authenticated;
