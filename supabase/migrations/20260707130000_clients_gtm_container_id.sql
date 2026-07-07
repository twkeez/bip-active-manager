-- Add GTM container ID to clients so we can verify Tag Manager is configured.
alter table public.clients
  add column if not exists gtm_container_id text;
