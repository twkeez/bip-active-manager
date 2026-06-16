create table if not exists public.sales_prospect_runs (
  id bigint generated always as identity primary key,
  created_by uuid not null references auth.users(id) on delete cascade,
  prospect_name text,
  prospect_url text not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_prospect_runs_created_by
  on public.sales_prospect_runs (created_by, created_at desc);

create table if not exists public.sales_prospect_audits (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.sales_prospect_runs(id) on delete cascade,
  seo_findings jsonb not null default '{}'::jsonb,
  lighthouse_scores jsonb not null default '{}'::jsonb,
  lighthouse_metrics jsonb not null default '{}'::jsonb,
  lighthouse_findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id)
);

create table if not exists public.sales_prospect_ai_outputs (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.sales_prospect_runs(id) on delete cascade,
  summary_json jsonb not null default '{}'::jsonb,
  hostinger_prompt text not null default '',
  followup_email_draft text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id)
);

grant select, insert, update on public.sales_prospect_runs to authenticated;
grant select, insert, update on public.sales_prospect_audits to authenticated;
grant select, insert, update on public.sales_prospect_ai_outputs to authenticated;

alter table public.sales_prospect_runs enable row level security;
alter table public.sales_prospect_audits enable row level security;
alter table public.sales_prospect_ai_outputs enable row level security;

create policy "sales_prospect_runs_select_own"
  on public.sales_prospect_runs
  for select
  to authenticated
  using (created_by = auth.uid());

create policy "sales_prospect_runs_insert_own"
  on public.sales_prospect_runs
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "sales_prospect_runs_update_own"
  on public.sales_prospect_runs
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "sales_prospect_audits_select_own_run"
  on public.sales_prospect_audits
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sales_prospect_runs runs
      where runs.id = sales_prospect_audits.run_id
        and runs.created_by = auth.uid()
    )
  );

create policy "sales_prospect_audits_insert_own_run"
  on public.sales_prospect_audits
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sales_prospect_runs runs
      where runs.id = sales_prospect_audits.run_id
        and runs.created_by = auth.uid()
    )
  );

create policy "sales_prospect_audits_update_own_run"
  on public.sales_prospect_audits
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.sales_prospect_runs runs
      where runs.id = sales_prospect_audits.run_id
        and runs.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sales_prospect_runs runs
      where runs.id = sales_prospect_audits.run_id
        and runs.created_by = auth.uid()
    )
  );

create policy "sales_prospect_ai_outputs_select_own_run"
  on public.sales_prospect_ai_outputs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sales_prospect_runs runs
      where runs.id = sales_prospect_ai_outputs.run_id
        and runs.created_by = auth.uid()
    )
  );

create policy "sales_prospect_ai_outputs_insert_own_run"
  on public.sales_prospect_ai_outputs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sales_prospect_runs runs
      where runs.id = sales_prospect_ai_outputs.run_id
        and runs.created_by = auth.uid()
    )
  );

create policy "sales_prospect_ai_outputs_update_own_run"
  on public.sales_prospect_ai_outputs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.sales_prospect_runs runs
      where runs.id = sales_prospect_ai_outputs.run_id
        and runs.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sales_prospect_runs runs
      where runs.id = sales_prospect_ai_outputs.run_id
        and runs.created_by = auth.uid()
    )
  );
