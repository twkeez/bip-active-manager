-- Basecamp integration schema for OAuth tokens, communication events, and sync status.

create table if not exists public.basecamp_oauth_tokens (
  id bigint primary key default 1,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  account_id text not null,
  token_type text not null default 'Bearer',
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basecamp_oauth_tokens_singleton check (id = 1)
);

create table if not exists public.basecamp_people_cache (
  person_id bigint primary key,
  email text,
  name text,
  fetched_at timestamptz not null default now()
);

create table if not exists public.basecamp_communication_events (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  basecamp_project_id text not null,
  basecamp_recording_id bigint not null,
  parent_recording_id bigint,
  kind text not null check (kind in ('message', 'comment')),
  occurred_at timestamptz not null,
  author_person_id bigint,
  author_email text,
  is_internal boolean not null default false,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (basecamp_recording_id, kind)
);

create table if not exists public.basecamp_sync_state (
  id bigint primary key default 1,
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint basecamp_sync_state_singleton check (id = 1)
);

grant select on public.basecamp_sync_state to authenticated;

alter table public.basecamp_oauth_tokens enable row level security;
alter table public.basecamp_people_cache enable row level security;
alter table public.basecamp_communication_events enable row level security;
alter table public.basecamp_sync_state enable row level security;

drop policy if exists "basecamp_sync_state_select_authenticated" on public.basecamp_sync_state;
create policy "basecamp_sync_state_select_authenticated"
  on public.basecamp_sync_state
  for select
  to authenticated
  using (true);

alter table public.clients
  add column if not exists last_communication_at timestamptz,
  add column if not exists last_event_is_internal boolean,
  add column if not exists needs_reply boolean not null default false,
  add column if not exists days_stale integer;

create index if not exists idx_basecamp_events_client_occurred_at
  on public.basecamp_communication_events (client_id, occurred_at desc);

create index if not exists idx_basecamp_events_project_occurred_at
  on public.basecamp_communication_events (basecamp_project_id, occurred_at desc);

create index if not exists idx_clients_needs_reply
  on public.clients (needs_reply);

create index if not exists idx_clients_days_stale
  on public.clients (days_stale);
