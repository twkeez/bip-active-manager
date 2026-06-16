create table if not exists public.integration_api_tokens (
  id bigint generated always as identity primary key,
  provider text not null,
  token_type text not null default 'user',
  access_token text not null,
  expires_at timestamptz,
  last_refreshed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, token_type)
);

create index if not exists idx_integration_api_tokens_provider
  on public.integration_api_tokens (provider, token_type);

alter table public.integration_api_tokens enable row level security;
