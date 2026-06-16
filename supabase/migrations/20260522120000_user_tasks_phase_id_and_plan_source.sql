alter table public.user_tasks
  add column if not exists phase_id bigint references public.client_project_phases(id) on delete set null;

create index if not exists idx_user_tasks_owner_project_phase_status
  on public.user_tasks (owner_user_id, project_id, phase_id, status);

alter table public.user_tasks drop constraint if exists user_tasks_source_type_check;

alter table public.user_tasks
  add constraint user_tasks_source_type_check
  check (source_type in ('manual', 'basecamp', 'email', 'plan'));
