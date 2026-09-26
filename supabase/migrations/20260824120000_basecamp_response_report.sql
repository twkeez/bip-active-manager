-- Per-project response report: who spoke last, when we last replied, and when
-- the client last reached out. Everything here already lives in
-- basecamp_communication_events. This view picks the latest row on each side
-- of the internal/client split, so the report is one query instead of one
-- query per project.
--
-- Keyed by Basecamp project, not by client (see
-- 20260904190000_monitor_basecamp_independently.sql): every project in the
-- roster appears, the client is an optional label, and ignored projects are
-- left out, as they are on the Coal Mines board.

drop view if exists public.basecamp_response_report;

create view public.basecamp_response_report
with (security_invoker = on) as
with latest_internal as (
  select distinct on (basecamp_project_id)
    basecamp_project_id,
    occurred_at,
    author_email,
    author_person_id,
    thread_title,
    thread_url
  from public.basecamp_communication_events
  where is_internal = true
  order by basecamp_project_id, occurred_at desc
),
latest_client as (
  select distinct on (basecamp_project_id)
    basecamp_project_id,
    occurred_at,
    author_email,
    author_person_id,
    thread_title,
    thread_url
  from public.basecamp_communication_events
  where is_internal = false
  order by basecamp_project_id, occurred_at desc
)
select
  bp.basecamp_project_id,
  bp.name                             as basecamp_project_name,
  c.id                                as client_id,
  coalesce(c.account_name, bp.name)   as account_name,
  c.marketing_strategist,
  c.is_low_contact,
  c.is_website_only,
  c.reply_acknowledged_for_occurred_at,

  li.occurred_at                      as last_internal_at,
  -- Fall back to the raw email when Basecamp never gave us a name for them.
  coalesce(ip.name, li.author_email)  as last_internal_author,
  li.author_email                     as last_internal_author_email,
  li.thread_title                     as last_internal_thread_title,
  li.thread_url                       as last_internal_thread_url,

  lc.occurred_at                      as last_client_at,
  coalesce(cp.name, lc.author_email)  as last_client_author,
  lc.author_email                     as last_client_author_email,
  lc.thread_title                     as last_client_thread_title,
  lc.thread_url                       as last_client_thread_url,

  (
    lc.occurred_at is not null
    and (li.occurred_at is null or lc.occurred_at > li.occurred_at)
  )                                   as client_spoke_last,

  case
    when li.occurred_at is null then null
    else (current_date - li.occurred_at::date)
  end                                 as days_since_our_reply,
  case
    when lc.occurred_at is null then null
    else (current_date - lc.occurred_at::date)
  end                                 as days_since_client_contact
from public.basecamp_projects bp
left join public.clients c on c.id = bp.client_id
left join latest_internal li on li.basecamp_project_id = bp.basecamp_project_id
left join latest_client   lc on lc.basecamp_project_id = bp.basecamp_project_id
-- Prefer the person-id match; fall back to email so older rows still resolve.
left join lateral (
  select p.name
  from public.basecamp_people_cache p
  where p.person_id = li.author_person_id
     or (li.author_email is not null and lower(p.email) = lower(li.author_email))
  order by (p.person_id = li.author_person_id) desc nulls last
  limit 1
) ip on true
left join lateral (
  select p.name
  from public.basecamp_people_cache p
  where p.person_id = lc.author_person_id
     or (lc.author_email is not null and lower(p.email) = lower(lc.author_email))
  order by (p.person_id = lc.author_person_id) desc nulls last
  limit 1
) cp on true
where not exists (
  select 1
  from public.basecamp_project_ignores i
  where i.basecamp_project_id = bp.basecamp_project_id
);

grant select on public.basecamp_response_report to authenticated;
