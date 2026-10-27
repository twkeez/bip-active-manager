-- One row per Claude API call BIP Control makes: which feature, which model,
-- the tokens it used and what that cost. Until now the only view of AI spend
-- was the Anthropic Console's total, so a feature quietly re-sending a large
-- request every 30 minutes went unnoticed for a month (2026-10-27).
--
-- cost_usd is computed in the app from the list price of the model at the
-- time of the call; the Console's bill remains the authority.
--
-- Server-only: row-level security on with no policies.

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  web_searches integer not null default 0,
  cost_usd numeric(12, 6) not null default 0
);

create index if not exists ai_usage_created_at_idx on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;
