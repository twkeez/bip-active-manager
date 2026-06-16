alter table public.client_lighthouse_snapshots
  add column if not exists seo_blockers jsonb not null default '[]'::jsonb,
  add column if not exists helpdesk_items jsonb not null default '[]'::jsonb;
