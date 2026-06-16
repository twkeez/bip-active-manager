alter table public.user_tasks
  drop constraint if exists user_tasks_status_check;

update public.user_tasks
set status = 'not_started'
where status = 'inbox';

alter table public.user_tasks
  alter column status set default 'not_started';

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
