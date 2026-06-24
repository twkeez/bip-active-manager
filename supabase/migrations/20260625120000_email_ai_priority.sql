-- AI-assessed priority for triaged emails. Populated by lib/gmail/ai-priority.ts
-- after each sync; drives the admin-only "Needs your attention" panel.
alter table public.user_email_messages
  add column if not exists ai_priority text check (ai_priority in ('high','medium','low')),
  add column if not exists ai_priority_reason text,
  add column if not exists ai_assessed_at timestamptz;

create index if not exists idx_user_email_messages_owner_ai_priority
  on public.user_email_messages (owner_user_id, ai_priority);
