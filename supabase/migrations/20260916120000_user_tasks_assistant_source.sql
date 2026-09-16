-- Tasks the assistant created.
--
-- The assistant can add tasks to your list once you confirm, and every change
-- it makes has an Undo. Undoing a change is a restore; undoing a *new* task is
-- a delete — and a delete must never reach a task you typed yourself. Marking
-- assistant-made tasks with their own source is what lets Undo delete only
-- those, and it also shows which tasks came from a conversation.

alter table public.user_tasks
  drop constraint if exists user_tasks_source_type_check;

alter table public.user_tasks
  add constraint user_tasks_source_type_check
  check (source_type = any (array['manual', 'basecamp', 'email', 'plan', 'assistant']));
