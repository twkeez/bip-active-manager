-- Communication events synced from the Illuminare Basecamp (messages + comments),
-- plus per-client "last communication" aggregate columns on illuminare_clients.

create table if not exists public.illuminare_comms_events (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.illuminare_clients(id) on delete cascade,
  basecamp_project_id text not null,
  recording_id bigint not null,
  kind text not null,                 -- 'message' | 'comment'
  occurred_at timestamptz not null,
  author_name text,
  author_email text,
  is_internal boolean not null default false,  -- true = from us (Beyond Indigo)
  title text,
  excerpt text,
  url text,
  updated_at timestamptz not null default now(),
  unique (basecamp_project_id, recording_id, kind)
);

comment on table public.illuminare_comms_events is
  'Basecamp messages/comments for Illuminare clients';

create index if not exists illuminare_comms_events_client_occurred_idx
  on public.illuminare_comms_events (client_id, occurred_at desc);

alter table public.illuminare_comms_events enable row level security;

-- Staff can read the feed; writes happen via the service-role sync (bypasses RLS).
create policy "illuminare_comms_events_select_authenticated"
  on public.illuminare_comms_events for select to authenticated using (true);

alter table public.illuminare_clients
  add column if not exists last_communication_at timestamptz,
  add column if not exists last_comm_is_internal boolean,
  add column if not exists needs_reply boolean not null default false,
  add column if not exists days_stale integer,
  add column if not exists comms_synced_at timestamptz;
