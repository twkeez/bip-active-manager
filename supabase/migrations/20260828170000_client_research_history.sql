-- Keep previous versions of AI research instead of destroying them on re-run.
--
-- client_onboarding_intake is unique (client_id), so every research tool upserts
-- over the row: a re-run permanently replaced the market snapshot, competitor
-- work, campaign plan or brand pull for the whole team, with a browser confirm()
-- as the only guard. These cost an AI call and get read by everyone, so losing
-- one to a stray click is too easy.
--
-- The intake row stays the current version, so every existing reader is
-- unaffected. This table only receives the outgoing version as it is replaced.

create table if not exists public.client_research_history (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  kind text not null check (
    kind in ('discovery', 'competitor_ads', 'campaign_plan', 'brand_elements')
  ),
  payload jsonb not null,
  -- When the archived version was originally produced (its *_at on the intake
  -- row), not when it was superseded.
  captured_at timestamptz,
  archived_at timestamptz not null default now(),
  archived_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_client_research_history_lookup
  on public.client_research_history (client_id, kind, archived_at desc);

grant select, insert on public.client_research_history to authenticated;
grant usage, select on sequence public.client_research_history_id_seq to authenticated;

alter table public.client_research_history enable row level security;

-- Shared team data, matching client_onboarding_intake. No delete grant: the
-- point of the table is that it does not lose things.
create policy "client_research_history_read_write_authenticated"
  on public.client_research_history
  for select to authenticated using (true);

create policy "client_research_history_insert_authenticated"
  on public.client_research_history
  for insert to authenticated with check (true);
