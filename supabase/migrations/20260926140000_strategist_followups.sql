-- "Notify strategist" from the response report, and the follow-up list that
-- makes sure each note was acted on.
--
-- A row is written when the email has gone out. It closes itself only when
-- the person asked replies in that Basecamp thread after the note (or, for a
-- note with no thread, posts in the project), or when someone marks it done by
-- hand. Nothing is deleted, so "how long did that take?" stays answerable.

create table if not exists public.strategist_followups (
  id bigint generated always as identity primary key,
  basecamp_project_id text not null,
  project_name text not null,
  client_id bigint references public.clients(id) on delete set null,
  recipient_name text,
  recipient_email text not null,
  subject text not null,
  note text not null,
  thread_title text,
  thread_url text,
  sent_by_user_id uuid not null references auth.users(id),
  sent_by_email text,
  sent_at timestamptz not null default now(),
  -- Re-sent once to the strategist, copying the sender, after two days open.
  renudged_at timestamptz,
  state text not null default 'open' check (state in ('open', 'done')),
  resolution text check (resolution in ('we_posted', 'marked_done')),
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists idx_strategist_followups_open
  on public.strategist_followups (state, sent_at);
create index if not exists idx_strategist_followups_project
  on public.strategist_followups (basecamp_project_id);

alter table public.strategist_followups enable row level security;

grant select, insert, update on public.strategist_followups to authenticated;

drop policy if exists "strategist_followups_select" on public.strategist_followups;
create policy "strategist_followups_select"
  on public.strategist_followups for select to authenticated using (true);

drop policy if exists "strategist_followups_insert" on public.strategist_followups;
create policy "strategist_followups_insert"
  on public.strategist_followups for insert to authenticated
  with check (sent_by_user_id = auth.uid());

drop policy if exists "strategist_followups_update" on public.strategist_followups;
create policy "strategist_followups_update"
  on public.strategist_followups for update to authenticated using (true) with check (true);
