-- Clients imported from spreadsheet; id is auto-generated (bigint identity).
create table if not exists public.clients (
  id bigint generated always as identity primary key,
  account_name text not null,
  marketing_strategist text,
  total_package_hours numeric,
  hours_for_strategist numeric,
  blog text,
  smm text,
  seo text,
  ppc text,
  orm text,
  ads_customer_id text,
  ga4_id text,
  sc_url text,
  website text,
  ga4_property_id text,
  basecamp_project_id text,
  harvest_project_id text,
  harvest_client_id text,
  tier text,
  created_at timestamptz not null default now()
);

comment on table public.clients is 'Client accounts';

alter table public.clients enable row level security;
