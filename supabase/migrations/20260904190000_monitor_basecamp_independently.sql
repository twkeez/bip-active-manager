-- Watch Basecamp itself, not the subset of Basecamp that has a client record.
--
-- basecamp_communication_events.client_id was NOT NULL and a foreign key to
-- clients, which made the client list the gate on what could be monitored at
-- all. A Basecamp project with no client record was never fetched, so it could
-- never produce a finding — indistinguishable, on the Coal Mines board, from a
-- project with nothing wrong. 55 active projects were in that state, and the
-- three clients sharing a project ID were skipped outright.
--
-- After this, the project is the unit of monitoring and the client is an
-- optional label on it.

alter table public.basecamp_communication_events
  alter column client_id drop not null;

-- So a thread can be named without a client record to look the name up in.
alter table public.basecamp_communication_events
  add column if not exists basecamp_project_name text;

comment on column public.basecamp_communication_events.client_id is
  'Optional. Null means no client record claims this Basecamp project; the thread is still monitored.';

-- The roster of projects the sync walks, so the app knows what exists in
-- Basecamp without an API call on every page load.
create table if not exists public.basecamp_projects (
  basecamp_project_id text primary key,
  name text not null,
  status text,
  client_id bigint references public.clients(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.basecamp_projects enable row level security;

grant select on public.basecamp_projects to authenticated;

drop policy if exists "basecamp_projects_select_authenticated" on public.basecamp_projects;
create policy "basecamp_projects_select_authenticated"
  on public.basecamp_projects
  for select
  to authenticated
  using (true);

create index if not exists idx_basecamp_projects_client
  on public.basecamp_projects (client_id);

-- Backfill the project name onto events we already hold, so existing threads
-- do not read as "Basecamp project 19768829" until they next change.
update public.basecamp_communication_events e
set basecamp_project_name = c.account_name
from public.clients c
where e.client_id = c.id
  and e.basecamp_project_name is null;
