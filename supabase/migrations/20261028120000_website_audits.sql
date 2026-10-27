-- Website, SEO & AI Search Audit runs: one row per audit of a client's or a
-- prospect's website. Results are filled section by section (crawl, then
-- authority, AI visibility, content and score) into `results`; each step's
-- state is in `stage_status`. Re-running the same domain makes a new row, so
-- the report can show "today vs last run".
--
-- Server-only: row-level security on with no policies.

create table if not exists public.website_audits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  created_by text,
  client_id bigint references public.clients(id) on delete set null,
  domain text not null,
  practice_name text not null,
  city text,
  state text,
  competitors text[] not null default '{}',
  stage_status jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  score numeric,
  dataforseo_cost_usd numeric(10, 4) not null default 0,
  ai_cost_usd numeric(10, 4) not null default 0
);

create index if not exists website_audits_domain_idx on public.website_audits (domain, created_at desc);

alter table public.website_audits enable row level security;
