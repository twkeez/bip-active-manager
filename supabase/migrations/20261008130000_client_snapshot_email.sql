-- Monthly Snapshot, step 2b: the "your snapshot is ready" email.
--
-- Each client gets one link kept for email ("email" kind): its token is
-- recomputed on the server from the link's id with a private key, so every
-- monthly email carries the same address and the database still stores only
-- a hash. Links made by hand stay "manual".
--
-- Recipients are set per client by an admin. Every send, sent or failed, is
-- logged with who sent it, to whom, and which published snapshot it pointed
-- at. Server only: RLS on, no policies, nothing granted to the browser roles.

alter table public.client_snapshot_links
  add column if not exists kind text not null default 'manual' check (kind in ('manual', 'email'));

create table if not exists public.client_snapshot_recipients (
  client_id bigint primary key references public.clients(id) on delete cascade,
  emails text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by_email text not null
);

create table if not exists public.client_snapshot_sends (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  publication_id bigint references public.client_snapshot_publications(id) on delete set null,
  link_id bigint references public.client_snapshot_links(id) on delete set null,
  recipients text[] not null,
  status text not null check (status in ('sent', 'failed')),
  error text,
  sent_at timestamptz not null default now(),
  sent_by_email text not null
);
create index if not exists client_snapshot_sends_client on public.client_snapshot_sends (client_id, sent_at desc);

alter table public.client_snapshot_recipients enable row level security;
alter table public.client_snapshot_sends enable row level security;
revoke all on public.client_snapshot_recipients, public.client_snapshot_sends from anon, authenticated;
