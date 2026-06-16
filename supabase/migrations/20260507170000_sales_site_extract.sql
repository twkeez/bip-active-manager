alter table public.sales_prospect_audits
  add column if not exists site_extract jsonb not null default '{}'::jsonb;

alter table public.sales_prospect_audits
  add column if not exists extract_sources jsonb not null default '[]'::jsonb;
