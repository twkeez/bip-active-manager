-- OAuth tokens for the separate Illuminare Basecamp account. Singleton row (id=1),
-- mirrors public.basecamp_oauth_tokens but kept isolated. Written/read only via the
-- service-role admin client, so RLS is enabled with no policies (service role bypasses).
create table if not exists public.illuminare_basecamp_oauth_tokens (
  id bigint primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  token_type text,
  scope text,
  account_id text not null,
  updated_at timestamptz not null default now()
);

comment on table public.illuminare_basecamp_oauth_tokens is
  'OAuth tokens for the Illuminare Basecamp account (singleton id=1)';

alter table public.illuminare_basecamp_oauth_tokens enable row level security;
