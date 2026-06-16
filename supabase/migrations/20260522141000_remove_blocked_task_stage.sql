update public.user_tasks
set status = 'not_started'
where status = 'blocked';

alter table public.user_tasks
  drop constraint if exists user_tasks_status_check;

alter table public.user_tasks
  add constraint user_tasks_status_check
  check (
    status in (
      'not_started',
      'in_progress',
      'waiting_on_client',
      'done'
    )
  );
