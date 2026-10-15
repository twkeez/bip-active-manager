-- Zendesk help desk tickets, and the report that ties them to Master Sheet
-- practices.
--
-- Zendesk is copied here rather than read live because the report needs every
-- ticket back to the start, and Zendesk only hands those out through its
-- incremental export at 10 requests a minute. A copy is pulled once, then
-- topped up from the saved cursor.
--
-- Ticket text can contain things clients should not have emailed (logins,
-- phone numbers), so none of these tables are readable by signed-in users:
-- RLS is on with no policies, and the admin-only page reads them with the
-- service role.

create table if not exists public.zendesk_organizations (
  id bigint primary key,
  name text not null,
  domain_names text[] not null default '{}',
  source_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.zendesk_users (
  id bigint primary key,
  name text,
  email text,
  role text,
  organization_id bigint,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists idx_zendesk_users_email on public.zendesk_users (lower(email));

create table if not exists public.zendesk_tickets (
  id bigint primary key,
  subject text,
  -- The opening message, cut short. Enough to say what the ticket is about.
  description text,
  status text,
  channel text,
  requester_id bigint,
  submitter_id bigint,
  organization_id bigint,
  tags text[] not null default '{}',
  -- Web addresses written anywhere in the subject or opening message. A
  -- client's own URL in their ticket is the strongest match we have when the
  -- requester wrote in from a Gmail address.
  mentioned_domains text[] not null default '{}',
  source_created_at timestamptz,
  source_updated_at timestamptz,
  category text,
  gist text,
  categorized_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists idx_zendesk_tickets_requester on public.zendesk_tickets (requester_id);
create index if not exists idx_zendesk_tickets_uncategorized on public.zendesk_tickets (id) where categorized_at is null;

-- One row per Zendesk stream ('organizations', 'users', 'tickets'): where the
-- export got to, so a run that stops for time picks up exactly there.
create table if not exists public.zendesk_sync_state (
  stream text primary key,
  cursor text,
  -- True once the stream has reached the present at least once.
  caught_up boolean not null default false,
  last_run_at timestamptz,
  last_error text
);

-- Corrections typed into the report's Unmatched tab, kept so the next run
-- does not ask again. practice_name 'IGNORE' marks a requester who is not a
-- client (staff, vendors, spam).
create table if not exists public.help_desk_match_overrides (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('requester_email')),
  -- Stored lowercased, so the plain unique constraint is case-insensitive.
  value text not null check (value = lower(value)),
  practice_name text not null,
  created_at timestamptz not null default now(),
  created_by text,
  unique (kind, value)
);

create table if not exists public.help_desk_report_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  ran_by text,
  summary jsonb not null default '{}'::jsonb
);

alter table public.zendesk_organizations enable row level security;
alter table public.zendesk_users enable row level security;
alter table public.zendesk_tickets enable row level security;
alter table public.zendesk_sync_state enable row level security;
alter table public.help_desk_match_overrides enable row level security;
alter table public.help_desk_report_runs enable row level security;
