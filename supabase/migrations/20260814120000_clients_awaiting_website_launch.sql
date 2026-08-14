-- "Pending website launch": a new client (or a new service on an existing
-- client) that is in onboarding and blocked waiting for their website to go
-- live before services can begin. Expected to be a small set at any time.
--
-- Modelled as an explicit flag rather than derived, because "waiting on the
-- website" is a judgement the strategist makes — it isn't reliably inferable
-- from the onboarding checklist, which tracks service-launch tasks (baseline
-- crawl, keyword targets) rather than the website itself.

alter table public.clients
  add column if not exists awaiting_website_launch boolean not null default false;

comment on column public.clients.awaiting_website_launch is
  'True while the client is in onboarding and blocked on their website launching before services start. Drives the "Pending website launch" status on the Clients page.';

-- The Clients page groups every client into exactly one of three states, so
-- this pairs with onboarding_status on every read.
create index if not exists clients_status_buckets_idx
  on public.clients (awaiting_website_launch, onboarding_status);
