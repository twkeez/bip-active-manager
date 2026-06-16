alter table public.sales_prospect_ai_outputs
  add column if not exists logo_analysis jsonb not null default '{}'::jsonb;

alter table public.sales_prospect_ai_outputs
  add column if not exists prompt_brief jsonb not null default '{}'::jsonb;
