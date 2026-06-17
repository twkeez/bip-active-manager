-- GA4 snapshots: stores totals, channel breakdown, top pages for each sync run
create table client_ga4_snapshots (
  id                 serial primary key,
  client_id          integer not null references clients(id) on delete cascade,
  property_id        text not null,
  start_date         date not null,
  end_date           date not null,
  run_status         text not null default 'running' check (run_status in ('running','completed','failed')),
  error_message      text,
  totals             jsonb not null default '{}',
  previous_totals    jsonb,
  channel_breakdown  jsonb not null default '[]',
  top_pages          jsonb not null default '[]',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table client_ga4_snapshots enable row level security;

create policy "authenticated users can read ga4 snapshots"
  on client_ga4_snapshots for select to authenticated using (true);

-- GA4 signals: one row per alert, refreshed on each sync
create table client_ga4_signals (
  id             serial primary key,
  client_id      integer not null references clients(id) on delete cascade,
  snapshot_id    integer not null references client_ga4_snapshots(id) on delete cascade,
  signal_id      text not null,
  severity       text not null check (severity in ('critical','watch')),
  title          text not null,
  description    text,
  suggestion     text,
  metric_value   text,
  occurrence_key text not null,
  created_at     timestamptz not null default now()
);

alter table client_ga4_signals enable row level security;

create policy "authenticated users can read ga4 signals"
  on client_ga4_signals for select to authenticated using (true);

create index client_ga4_snapshots_client_id_idx on client_ga4_snapshots(client_id);
create index client_ga4_signals_client_id_idx on client_ga4_signals(client_id);
create index client_ga4_signals_snapshot_id_idx on client_ga4_signals(snapshot_id);
