-- Deliverables for Illuminare clients. Two kinds:
--   'recurring'  — ongoing retainer work (e.g. "4 blog posts / month"), driven by `cadence`.
--   'one_time'   — a single project; once completed we schedule a re-engagement nudge via
--                  `follow_up_at` so we remember to check back in occasionally.
create table if not exists public.illuminare_deliverables (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.illuminare_clients(id) on delete cascade,
  title text not null,
  detail text,
  kind text not null default 'one_time',          -- 'recurring' | 'one_time'
  cadence text,                                    -- recurring only: weekly|biweekly|monthly|quarterly|yearly
  status text not null default 'active',           -- 'active' | 'completed' | 'cancelled'
  start_date date,
  due_date date,                                   -- one_time target date
  completed_at timestamptz,                        -- when a one_time was finished
  follow_up_interval_days integer,                 -- days after completion to nudge for re-engagement
  follow_up_at date,                               -- next date to reach back out (rolls forward each check-in)
  last_followed_up_at timestamptz,                 -- when we last reached out
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.illuminare_deliverables is
  'Deliverables (recurring retainer work or one-time projects) for Illuminare clients';

create index if not exists illuminare_deliverables_client_id_idx
  on public.illuminare_deliverables (client_id);

-- Speeds up the "who needs a re-engagement nudge" query.
create index if not exists illuminare_deliverables_follow_up_idx
  on public.illuminare_deliverables (follow_up_at)
  where follow_up_at is not null;

alter table public.illuminare_deliverables enable row level security;

create policy "illuminare_deliverables_select_authenticated"
  on public.illuminare_deliverables for select to authenticated using (true);
create policy "illuminare_deliverables_insert_authenticated"
  on public.illuminare_deliverables for insert to authenticated with check (true);
create policy "illuminare_deliverables_update_authenticated"
  on public.illuminare_deliverables for update to authenticated using (true) with check (true);
create policy "illuminare_deliverables_delete_authenticated"
  on public.illuminare_deliverables for delete to authenticated using (true);
