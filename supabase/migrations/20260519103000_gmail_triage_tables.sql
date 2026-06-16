create table if not exists public.user_email_messages (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  gmail_history_id text,
  subject text,
  from_email text,
  from_name text,
  to_emails text[] not null default '{}'::text[],
  snippet text,
  body_text text,
  body_html text,
  internal_date timestamptz,
  label_ids text[] not null default '{}'::text[],
  is_read boolean not null default false,
  is_starred boolean not null default false,
  triage_status text not null default 'inbox' check (triage_status in ('inbox', 'needs_action', 'archived', 'deleted')),
  needs_action boolean not null default false,
  is_high_priority boolean not null default false,
  task_id bigint references public.user_tasks(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, gmail_message_id)
);

create index if not exists idx_user_email_messages_owner_internal_date
  on public.user_email_messages (owner_user_id, internal_date desc nulls last);

create index if not exists idx_user_email_messages_owner_needs_action
  on public.user_email_messages (owner_user_id, needs_action, is_high_priority);

create table if not exists public.user_email_sender_rules (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null,
  rule_type text not null check (rule_type in ('blacklist', 'always_high_priority')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, sender, rule_type)
);

create index if not exists idx_user_email_sender_rules_owner_type
  on public.user_email_sender_rules (owner_user_id, rule_type, is_active);

create table if not exists public.user_email_triage_events (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  message_id bigint not null references public.user_email_messages(id) on delete cascade,
  event_type text not null check (event_type in ('archive', 'trash', 'mark_read', 'mark_unread', 'star', 'unstar', 'create_task', 'blacklist_sender', 'set_high_priority')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_email_triage_events_owner_created
  on public.user_email_triage_events (owner_user_id, created_at desc);

create table if not exists public.user_email_sync_cursors (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  gmail_history_id text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.user_email_messages to authenticated;
grant select, insert, update, delete on public.user_email_sender_rules to authenticated;
grant select, insert, update, delete on public.user_email_triage_events to authenticated;
grant select, insert, update, delete on public.user_email_sync_cursors to authenticated;

alter table public.user_email_messages enable row level security;
alter table public.user_email_sender_rules enable row level security;
alter table public.user_email_triage_events enable row level security;
alter table public.user_email_sync_cursors enable row level security;

drop policy if exists "user_email_messages_select_own" on public.user_email_messages;
create policy "user_email_messages_select_own"
  on public.user_email_messages
  for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "user_email_messages_insert_own" on public.user_email_messages;
create policy "user_email_messages_insert_own"
  on public.user_email_messages
  for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "user_email_messages_update_own" on public.user_email_messages;
create policy "user_email_messages_update_own"
  on public.user_email_messages
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "user_email_messages_delete_own" on public.user_email_messages;
create policy "user_email_messages_delete_own"
  on public.user_email_messages
  for delete to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "user_email_sender_rules_select_own" on public.user_email_sender_rules;
create policy "user_email_sender_rules_select_own"
  on public.user_email_sender_rules
  for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "user_email_sender_rules_insert_own" on public.user_email_sender_rules;
create policy "user_email_sender_rules_insert_own"
  on public.user_email_sender_rules
  for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "user_email_sender_rules_update_own" on public.user_email_sender_rules;
create policy "user_email_sender_rules_update_own"
  on public.user_email_sender_rules
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "user_email_sender_rules_delete_own" on public.user_email_sender_rules;
create policy "user_email_sender_rules_delete_own"
  on public.user_email_sender_rules
  for delete to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "user_email_triage_events_select_own" on public.user_email_triage_events;
create policy "user_email_triage_events_select_own"
  on public.user_email_triage_events
  for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "user_email_triage_events_insert_own" on public.user_email_triage_events;
create policy "user_email_triage_events_insert_own"
  on public.user_email_triage_events
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.user_email_messages messages
      where messages.id = user_email_triage_events.message_id
        and messages.owner_user_id = auth.uid()
    )
  );

drop policy if exists "user_email_sync_cursors_select_own" on public.user_email_sync_cursors;
create policy "user_email_sync_cursors_select_own"
  on public.user_email_sync_cursors
  for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "user_email_sync_cursors_insert_own" on public.user_email_sync_cursors;
create policy "user_email_sync_cursors_insert_own"
  on public.user_email_sync_cursors
  for insert to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "user_email_sync_cursors_update_own" on public.user_email_sync_cursors;
create policy "user_email_sync_cursors_update_own"
  on public.user_email_sync_cursors
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
