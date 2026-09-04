-- Whether a Basecamp thread actually leaves something outstanding for us.
--
-- The thread canary flags any thread where the client spoke last, which is a
-- poor proxy for "they are waiting". Live data: "Closed for Labor Day" (an
-- announcement) and "Beyond Indigo 2025 Holiday Schedule" (a client saying
-- thanks) both surfaced as work. A "thanks" ends a conversation; it does not
-- open one.
--
-- Classification is stored rather than recomputed, so opening Coal Mines never
-- costs an API call, and a thread is only re-read when its last message
-- actually changes — which is what classified_excerpt is for.

alter table public.basecamp_communication_events
  add column if not exists reply_need text
  check (reply_need is null or reply_need in ('needs_reply', 'fyi', 'closed', 'unclear'));

alter table public.basecamp_communication_events
  add column if not exists reply_need_reason text;

-- True when the client is chasing, complaining, or reporting something broken —
-- these jump the queue regardless of how long they have been sitting.
alter table public.basecamp_communication_events
  add column if not exists reply_need_escalated boolean not null default false;

-- The exact excerpt the verdict was based on. When the thread moves on, this no
-- longer matches and the thread is re-read; unchanged, it is left alone.
alter table public.basecamp_communication_events
  add column if not exists classified_excerpt text;

alter table public.basecamp_communication_events
  add column if not exists classified_at timestamptz;

comment on column public.basecamp_communication_events.reply_need is
  'needs_reply = something is outstanding; fyi = informational; closed = acknowledged/complete; unclear = could not tell.';

comment on column public.basecamp_communication_events.classified_excerpt is
  'The thread_excerpt the verdict was based on. Re-classify only when this stops matching.';
