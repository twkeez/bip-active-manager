-- Poobah Client Watch (Tom, 2026-09-29): a notebook per watched client
-- (current status, open items, a running log, account basics) that Tom edits
-- on /client-watch and Claude reads and updates through the MCP connector.
-- Separate from the daily "Client watch" routine.
--
-- Rules:
--   * Nothing is deleted. A new status supersedes the old one, which stays as
--     history; a completed item stays, marked done.
--   * Every change records who made it (a person, or Claude on a person's
--     behalf) and when, in poobah_changes, in the same transaction as the
--     change itself: each write below is one function, so the change and its
--     record are saved together or not at all.
--   * Only the server reads or writes: row-level security is on with no
--     policies, and nothing is granted to the browser roles (anon,
--     authenticated). The server uses the service role, which bypasses RLS.

create table if not exists public.poobah_watches (
  id bigint generated always as identity primary key,
  -- The BIP Control client this is, when it is one; never a copy of it.
  client_id bigint references public.clients(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  basics text not null default '',
  created_at timestamptz not null default now(),
  created_by_kind text not null check (created_by_kind in ('person', 'claude')),
  created_by_email text not null,
  -- Last change of any kind, for "most recently updated" sorting.
  updated_at timestamptz not null default now()
);
create unique index if not exists poobah_watches_client_unique on public.poobah_watches (client_id) where client_id is not null;
create unique index if not exists poobah_watches_name_unique on public.poobah_watches (lower(trim(name)));

create table if not exists public.poobah_statuses (
  id bigint generated always as identity primary key,
  watch_id bigint not null references public.poobah_watches(id),
  status text not null check (length(trim(status)) > 0),
  set_at timestamptz not null default now(),
  set_by_kind text not null check (set_by_kind in ('person', 'claude')),
  set_by_email text not null
);
create index if not exists poobah_statuses_watch on public.poobah_statuses (watch_id, set_at desc, id desc);

create table if not exists public.poobah_items (
  id bigint generated always as identity primary key,
  watch_id bigint not null references public.poobah_watches(id),
  text text not null check (length(trim(text)) > 0),
  owner text,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  done_by_kind text check (done_by_kind in ('person', 'claude')),
  done_by_email text,
  created_at timestamptz not null default now(),
  created_by_kind text not null check (created_by_kind in ('person', 'claude')),
  created_by_email text not null,
  updated_at timestamptz not null default now()
);
create index if not exists poobah_items_watch on public.poobah_items (watch_id, done, created_at);

create table if not exists public.poobah_log (
  id bigint generated always as identity primary key,
  watch_id bigint not null references public.poobah_watches(id),
  entry_date date not null,
  text text not null check (length(trim(text)) > 0),
  source text not null check (length(trim(source)) > 0),
  created_at timestamptz not null default now(),
  created_by_kind text not null check (created_by_kind in ('person', 'claude')),
  created_by_email text not null
);
create index if not exists poobah_log_watch on public.poobah_log (watch_id, entry_date desc, id desc);

create table if not exists public.poobah_changes (
  id bigint generated always as identity primary key,
  watch_id bigint not null references public.poobah_watches(id),
  entity text not null,      -- watch | status | basics | item | log
  entity_id bigint,
  action text not null,      -- created | set | updated | completed | reopened | added
  before jsonb,
  after jsonb,
  actor_kind text not null check (actor_kind in ('person', 'claude')),
  actor_email text not null,
  at timestamptz not null default now()
);
create index if not exists poobah_changes_watch on public.poobah_changes (watch_id, at desc, id desc);

-- Server only.
alter table public.poobah_watches enable row level security;
alter table public.poobah_statuses enable row level security;
alter table public.poobah_items enable row level security;
alter table public.poobah_log enable row level security;
alter table public.poobah_changes enable row level security;
revoke all on public.poobah_watches, public.poobah_statuses, public.poobah_items, public.poobah_log, public.poobah_changes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Writes. Each returns the saved row(s) read back, so callers can confirm
-- exactly what was stored.
-- ---------------------------------------------------------------------------

create or replace function public.poobah_touch(p_watch_id bigint) returns void
language sql security invoker set search_path = public as $$
  update public.poobah_watches set updated_at = now() where id = p_watch_id;
$$;

create or replace function public.poobah_add_watch(
  p_name text, p_client_id bigint, p_status text, p_basics text, p_actor_kind text, p_actor_email text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  w public.poobah_watches;
  s public.poobah_statuses;
begin
  insert into public.poobah_watches (client_id, name, basics, created_by_kind, created_by_email)
  values (p_client_id, trim(p_name), coalesce(p_basics, ''), p_actor_kind, p_actor_email)
  returning * into w;
  insert into public.poobah_changes (watch_id, entity, entity_id, action, after, actor_kind, actor_email)
  values (w.id, 'watch', w.id, 'created', to_jsonb(w), p_actor_kind, p_actor_email);
  if p_status is not null and length(trim(p_status)) > 0 then
    insert into public.poobah_statuses (watch_id, status, set_by_kind, set_by_email)
    values (w.id, trim(p_status), p_actor_kind, p_actor_email) returning * into s;
    insert into public.poobah_changes (watch_id, entity, entity_id, action, after, actor_kind, actor_email)
    values (w.id, 'status', s.id, 'set', to_jsonb(s), p_actor_kind, p_actor_email);
  end if;
  return jsonb_build_object('watch', to_jsonb(w), 'status', to_jsonb(s));
end $$;

create or replace function public.poobah_set_status(
  p_watch_id bigint, p_status text, p_actor_kind text, p_actor_email text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  prev public.poobah_statuses;
  s public.poobah_statuses;
begin
  select * into prev from public.poobah_statuses where watch_id = p_watch_id order by set_at desc, id desc limit 1;
  insert into public.poobah_statuses (watch_id, status, set_by_kind, set_by_email)
  values (p_watch_id, trim(p_status), p_actor_kind, p_actor_email) returning * into s;
  insert into public.poobah_changes (watch_id, entity, entity_id, action, before, after, actor_kind, actor_email)
  values (p_watch_id, 'status', s.id, 'set', to_jsonb(prev), to_jsonb(s), p_actor_kind, p_actor_email);
  perform public.poobah_touch(p_watch_id);
  return to_jsonb(s);
end $$;

create or replace function public.poobah_set_basics(
  p_watch_id bigint, p_basics text, p_actor_kind text, p_actor_email text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  prev text;
  w public.poobah_watches;
begin
  select basics into prev from public.poobah_watches where id = p_watch_id for update;
  if not found then raise exception 'No watched client with id %', p_watch_id; end if;
  update public.poobah_watches set basics = coalesce(p_basics, ''), updated_at = now() where id = p_watch_id returning * into w;
  insert into public.poobah_changes (watch_id, entity, entity_id, action, before, after, actor_kind, actor_email)
  values (p_watch_id, 'basics', p_watch_id, 'updated', to_jsonb(prev), to_jsonb(w.basics), p_actor_kind, p_actor_email);
  return to_jsonb(w);
end $$;

create or replace function public.poobah_add_log(
  p_watch_id bigint, p_entry_date date, p_text text, p_source text, p_actor_kind text, p_actor_email text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  l public.poobah_log;
begin
  insert into public.poobah_log (watch_id, entry_date, text, source, created_by_kind, created_by_email)
  values (p_watch_id, p_entry_date, trim(p_text), trim(p_source), p_actor_kind, p_actor_email) returning * into l;
  insert into public.poobah_changes (watch_id, entity, entity_id, action, after, actor_kind, actor_email)
  values (p_watch_id, 'log', l.id, 'added', to_jsonb(l), p_actor_kind, p_actor_email);
  perform public.poobah_touch(p_watch_id);
  return to_jsonb(l);
end $$;

create or replace function public.poobah_add_item(
  p_watch_id bigint, p_text text, p_owner text, p_due_date date, p_actor_kind text, p_actor_email text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  i public.poobah_items;
begin
  insert into public.poobah_items (watch_id, text, owner, due_date, created_by_kind, created_by_email)
  values (p_watch_id, trim(p_text), nullif(trim(coalesce(p_owner, '')), ''), p_due_date, p_actor_kind, p_actor_email)
  returning * into i;
  insert into public.poobah_changes (watch_id, entity, entity_id, action, after, actor_kind, actor_email)
  values (p_watch_id, 'item', i.id, 'added', to_jsonb(i), p_actor_kind, p_actor_email);
  perform public.poobah_touch(p_watch_id);
  return to_jsonb(i);
end $$;

-- Changes only the fields named in p_fields (keys: text, owner, due_date, done).
-- A key present with null clears owner or due_date; text cannot be cleared.
create or replace function public.poobah_update_item(
  p_item_id bigint, p_fields jsonb, p_actor_kind text, p_actor_email text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  prev public.poobah_items;
  i public.poobah_items;
  new_done boolean;
begin
  select * into prev from public.poobah_items where id = p_item_id for update;
  if not found then raise exception 'No open item with id %', p_item_id; end if;
  new_done := case when p_fields ? 'done' then (p_fields->>'done')::boolean else prev.done end;
  update public.poobah_items set
    text = case when p_fields ? 'text' then trim(p_fields->>'text') else text end,
    owner = case when p_fields ? 'owner' then nullif(trim(coalesce(p_fields->>'owner', '')), '') else owner end,
    due_date = case when p_fields ? 'due_date' then (p_fields->>'due_date')::date else due_date end,
    done = new_done,
    done_at = case when new_done and not prev.done then now() when not new_done then null else done_at end,
    done_by_kind = case when new_done and not prev.done then p_actor_kind when not new_done then null else done_by_kind end,
    done_by_email = case when new_done and not prev.done then p_actor_email when not new_done then null else done_by_email end,
    updated_at = now()
  where id = p_item_id
  returning * into i;
  insert into public.poobah_changes (watch_id, entity, entity_id, action, before, after, actor_kind, actor_email)
  values (
    i.watch_id, 'item', i.id,
    case when new_done and not prev.done then 'completed' when prev.done and not new_done then 'reopened' else 'updated' end,
    to_jsonb(prev), to_jsonb(i), p_actor_kind, p_actor_email
  );
  perform public.poobah_touch(i.watch_id);
  return to_jsonb(i);
end $$;

-- Server only, like the tables.
revoke execute on function public.poobah_touch(bigint) from public, anon, authenticated;
revoke execute on function public.poobah_add_watch(text, bigint, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.poobah_set_status(bigint, text, text, text) from public, anon, authenticated;
revoke execute on function public.poobah_set_basics(bigint, text, text, text) from public, anon, authenticated;
revoke execute on function public.poobah_add_log(bigint, date, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.poobah_add_item(bigint, text, text, date, text, text) from public, anon, authenticated;
revoke execute on function public.poobah_update_item(bigint, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.poobah_touch(bigint) to service_role;
grant execute on function public.poobah_add_watch(text, bigint, text, text, text, text) to service_role;
grant execute on function public.poobah_set_status(bigint, text, text, text) to service_role;
grant execute on function public.poobah_set_basics(bigint, text, text, text) to service_role;
grant execute on function public.poobah_add_log(bigint, date, text, text, text, text) to service_role;
grant execute on function public.poobah_add_item(bigint, text, text, date, text, text) to service_role;
grant execute on function public.poobah_update_item(bigint, jsonb, text, text) to service_role;
