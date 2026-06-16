-- Add Basecamp thread content fields for dashboard flyout previews.

alter table public.basecamp_communication_events
  add column if not exists thread_title text,
  add column if not exists thread_excerpt text,
  add column if not exists thread_body text,
  add column if not exists thread_url text;

grant select on public.basecamp_communication_events to authenticated;

drop policy if exists "basecamp_communication_events_select_authenticated" on public.basecamp_communication_events;
create policy "basecamp_communication_events_select_authenticated"
  on public.basecamp_communication_events
  for select
  to authenticated
  using (true);
