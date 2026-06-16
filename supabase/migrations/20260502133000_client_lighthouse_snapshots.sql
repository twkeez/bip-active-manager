create table if not exists public.client_lighthouse_snapshots (
  client_id bigint primary key references public.clients(id) on delete cascade,
  url text not null,
  fetched_at timestamptz not null,
  scores jsonb not null,
  metrics jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_lighthouse_snapshots_fetched_at
  on public.client_lighthouse_snapshots (fetched_at desc);

grant select on public.client_lighthouse_snapshots to authenticated;

alter table public.client_lighthouse_snapshots enable row level security;

drop policy if exists "client_lighthouse_snapshots_select_authenticated" on public.client_lighthouse_snapshots;
create policy "client_lighthouse_snapshots_select_authenticated"
  on public.client_lighthouse_snapshots
  for select
  to authenticated
  using (true);
