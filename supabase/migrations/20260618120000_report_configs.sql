-- Master report template config (single row, key = 'master')
create table if not exists report_template_config (
  key text primary key default 'master',
  config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table report_template_config enable row level security;
create policy "auth users can read template config" on report_template_config
  for select to authenticated using (true);
create policy "auth users can upsert template config" on report_template_config
  for all to authenticated using (true) with check (true);

-- Per-client report layout configs
create table if not exists client_report_configs (
  client_id integer primary key references clients(id) on delete cascade,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table client_report_configs enable row level security;
create policy "auth users can manage client report configs" on client_report_configs
  for all to authenticated using (true) with check (true);
