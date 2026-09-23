-- The Basecamp watch list: threads waiting on us, kept until they are dealt
-- with rather than rebuilt from scratch each run.
--
-- The routine runs store a snapshot per run, which answers "what did it find
-- at 10am?" but not "what is still outstanding?". Watching every two hours
-- makes that distinction the whole point: a thread flagged at 8am must still
-- be there at 10am, in the same place, until somebody answers it — and must
-- disappear on its own the moment they do.
--
-- One row per thread per reason. A thread can be waiting on a reply and, later,
-- go quiet; those are different asks and each clears on its own terms.

create table if not exists public.basecamp_watch_items (
  id bigint generated always as identity primary key,
  -- Basecamp's own id for the thread: stable across syncs and renames.
  recording_id bigint not null,
  basecamp_project_id text,
  client_id bigint references public.clients(id) on delete set null,
  -- Kept as text as well: a project with no client record still has threads,
  -- and the list must be readable without joining to something that is absent.
  client_name text not null,
  thread_title text not null,
  thread_url text,
  reason text not null check (reason in ('needs_reply', 'quiet')),
  -- Why the classifier says it needs an answer, in its words.
  reason_text text,
  -- The thread's last activity when it was flagged. A later message from us is
  -- what "answered" means, so the comparison point has to be stored.
  flagged_activity_at timestamptz not null,
  first_flagged_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  state text not null default 'open' check (state in ('open', 'resolved')),
  -- How it left the list: we posted a reply, someone marked it done, or it
  -- stopped qualifying (the client wrote again, the thread moved on).
  resolution text check (resolution in ('we_replied', 'marked_done', 'no_longer_flagged')),
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recording_id, reason)
);

create index if not exists idx_basecamp_watch_items_open
  on public.basecamp_watch_items (state, first_flagged_at desc);

alter table public.basecamp_watch_items enable row level security;

grant select on public.basecamp_watch_items to authenticated;

drop policy if exists "basecamp_watch_items_select_authenticated" on public.basecamp_watch_items;
create policy "basecamp_watch_items_select_authenticated"
  on public.basecamp_watch_items for select to authenticated using (true);

-- Writes go through the app's API with the service role, which checks the
-- person is signed in.

-- The watcher itself: through the working day, and once at night.
insert into public.routines (key, name, instruction, kind, settings, schedule, created_by)
values (
  'basecamp-watch',
  'Basecamp watch',
  'Check all client threads for new messages that need a response, and flag any with nothing posted in 14 days. Keep what it finds on the list until it is answered.',
  'basecamp_watch',
  '{"quietAfterDays": 14}'::jsonb,
  '{"days": [1, 2, 3, 4, 5], "hours": [8, 10, 12, 14, 16, 21], "minute": 0, "timezone": "America/New_York"}'::jsonb,
  'tom@beyondindigo.com'
)
on conflict (key) do nothing;

-- The Daily Basecamp Review is replaced by the watch, which does the same job
-- continuously and remembers what is outstanding. Paused rather than deleted,
-- so its history stays readable.
update public.routines set enabled = false, updated_at = now()
where key = 'daily-basecamp-review';
