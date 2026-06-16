create table if not exists public.client_lighthouse_occurrence_overrides (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  audit_id text not null,
  occurrence_key text not null,
  decision text not null check (decision in ('no_fix_needed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, audit_id, occurrence_key, decision)
);

create index if not exists idx_lighthouse_occurrence_overrides_client_decision
  on public.client_lighthouse_occurrence_overrides (client_id, decision);

grant select, insert on public.client_lighthouse_occurrence_overrides to authenticated;
grant usage, select on sequence public.client_lighthouse_occurrence_overrides_id_seq to authenticated;

alter table public.client_lighthouse_occurrence_overrides enable row level security;

drop policy if exists "client_lighthouse_occurrence_overrides_select_authenticated" on public.client_lighthouse_occurrence_overrides;
create policy "client_lighthouse_occurrence_overrides_select_authenticated"
  on public.client_lighthouse_occurrence_overrides
  for select
  to authenticated
  using (true);

drop policy if exists "client_lighthouse_occurrence_overrides_insert_authenticated" on public.client_lighthouse_occurrence_overrides;
create policy "client_lighthouse_occurrence_overrides_insert_authenticated"
  on public.client_lighthouse_occurrence_overrides
  for insert
  to authenticated
  with check (true);
