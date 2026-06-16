create table if not exists public.content_qa_rules (
  id bigint generated always as identity primary key,
  rule_id text not null unique,
  label text not null,
  description text,
  category text not null,
  severity_default text not null check (severity_default in ('critical', 'watch')),
  enabled boolean not null default true,
  weight integer not null default 10 check (weight >= 0 and weight <= 100),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_qa_rules_rule_id
  on public.content_qa_rules (rule_id);

grant select, insert, update, delete on public.content_qa_rules to authenticated;

alter table public.content_qa_rules enable row level security;

create policy "content_qa_rules_select_authenticated"
  on public.content_qa_rules
  for select to authenticated
  using (true);

create policy "content_qa_rules_insert_authenticated"
  on public.content_qa_rules
  for insert to authenticated
  with check (true);

create policy "content_qa_rules_update_authenticated"
  on public.content_qa_rules
  for update to authenticated
  using (true)
  with check (true);

create policy "content_qa_rules_delete_authenticated"
  on public.content_qa_rules
  for delete to authenticated
  using (true);

create table if not exists public.content_qa_rule_overrides (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  rule_id text not null references public.content_qa_rules(rule_id) on delete cascade,
  enabled_override boolean,
  severity_override text check (severity_override in ('critical', 'watch')),
  weight_override integer check (weight_override >= 0 and weight_override <= 100),
  config_override jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, client_id, rule_id)
);

create index if not exists idx_content_qa_rule_overrides_owner_client
  on public.content_qa_rule_overrides (owner_user_id, client_id, rule_id);

grant select, insert, update, delete on public.content_qa_rule_overrides to authenticated;

alter table public.content_qa_rule_overrides enable row level security;

create policy "content_qa_rule_overrides_select_own"
  on public.content_qa_rule_overrides
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "content_qa_rule_overrides_insert_own"
  on public.content_qa_rule_overrides
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "content_qa_rule_overrides_update_own"
  on public.content_qa_rule_overrides
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "content_qa_rule_overrides_delete_own"
  on public.content_qa_rule_overrides
  for delete to authenticated
  using (owner_user_id = auth.uid());
