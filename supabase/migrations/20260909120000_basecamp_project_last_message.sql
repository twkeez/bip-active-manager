-- The date of the last actual message in each Basecamp project.
--
-- Basecamp's own project list carries `last_event_at`, which looked like the
-- answer and is not: 30 of our projects share a last_event_at within two
-- seconds of each other on 2026-04-10, because some bulk account operation
-- touched them all. Deciding whether a project is a live practice on that basis
-- would have been deciding on an artefact.
--
-- The sync already fetches every project's topic list, so the newest topic date
-- is free — it just had nowhere to be stored.

alter table public.basecamp_projects
  add column if not exists last_message_at timestamptz;

comment on column public.basecamp_projects.last_message_at is
  'Newest message/topic in the project. Unlike Basecamp last_event_at this ignores bulk account operations.';

create index if not exists idx_basecamp_projects_last_message
  on public.basecamp_projects (last_message_at desc nulls last);
