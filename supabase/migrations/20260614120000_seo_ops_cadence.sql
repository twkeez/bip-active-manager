-- SEO ops cadence: recurring weekly/monthly/quarterly strategist checklist.

create table if not exists public.seo_ops_templates (
  id bigint generated always as identity primary key,
  item_key text not null unique check (char_length(trim(item_key)) > 0),
  label text not null check (char_length(trim(label)) > 0),
  cadence text not null check (cadence in ('weekly', 'monthly', 'quarterly')),
  verification text not null default 'manual'
    check (char_length(trim(verification)) > 0),
  sort_order integer not null default 0,
  requires_service text check (requires_service is null or requires_service in ('seo', 'blog')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seo_ops_templates_cadence_sort
  on public.seo_ops_templates (cadence, sort_order, id);

create table if not exists public.seo_ops_completions (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  item_key text not null check (char_length(trim(item_key)) > 0),
  period_key text not null check (char_length(trim(period_key)) > 0),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  viewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, item_key, period_key)
);

create index if not exists idx_seo_ops_completions_client_period
  on public.seo_ops_completions (client_id, period_key);

grant select on public.seo_ops_templates to authenticated;
grant select, insert, update, delete on public.seo_ops_completions to authenticated;

alter table public.seo_ops_templates enable row level security;
alter table public.seo_ops_completions enable row level security;

create policy "seo_ops_templates_select_authenticated"
  on public.seo_ops_templates
  for select
  to authenticated
  using (true);

create policy "seo_ops_completions_select_authenticated"
  on public.seo_ops_completions
  for select
  to authenticated
  using (true);

create policy "seo_ops_completions_insert_authenticated"
  on public.seo_ops_completions
  for insert
  to authenticated
  with check (true);

create policy "seo_ops_completions_update_authenticated"
  on public.seo_ops_completions
  for update
  to authenticated
  using (true)
  with check (true);

create policy "seo_ops_completions_delete_authenticated"
  on public.seo_ops_completions
  for delete
  to authenticated
  using (true);

insert into public.seo_ops_templates
  (item_key, label, cadence, verification, sort_order, requires_service, is_active)
values
  ('weekly_gsc_sanity', 'GSC sanity check (coverage, indexing, critical signals)', 'weekly', 'auto:gsc_health', 10, 'seo', true),
  ('weekly_rank_scan', 'Keyword rank tracking scan (±5 position swings)', 'weekly', 'auto:rank_fluctuations', 20, 'seo', true),
  ('weekly_gbp_engagement', 'GBP engagement (review responses + weekly post)', 'weekly', 'manual:gbp_engagement', 30, 'seo', true),
  ('monthly_gsc_page2', 'GSC page-2 query audit (positions 11–20)', 'monthly', 'auto:gsc_page2', 10, 'seo', true),
  ('monthly_on_page_refresh', 'On-page keyword optimization (one service page)', 'monthly', 'manual:on_page_refresh', 20, 'seo', true),
  ('monthly_internal_links', 'Internal link injection (2–3 links to money pages)', 'monthly', 'manual:internal_links', 30, 'seo', true),
  ('quarterly_keyword_gap', 'Keyword gap analysis vs local competitors', 'quarterly', 'manual:keyword_gap', 10, 'seo', false),
  ('quarterly_gsc_yoy', 'GSC performance YoY review', 'quarterly', 'manual:gsc_yoy', 20, 'seo', false),
  ('quarterly_nap_cleanup', 'Local directory & NAP cleanup', 'quarterly', 'manual:nap_cleanup', 30, 'seo', false)
on conflict (item_key) do nothing;
