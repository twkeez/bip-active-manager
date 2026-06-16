alter table public.user_tasks
  add column if not exists is_starred boolean not null default false;

create index if not exists idx_user_tasks_owner_starred
  on public.user_tasks (owner_user_id, is_starred, updated_at desc);
