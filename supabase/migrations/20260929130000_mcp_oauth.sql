-- Sign-in for the Claude connector (MCP) at /api/mcp: a small OAuth 2.1
-- authorization server inside the app. Claude registers itself (dynamic
-- client registration) or identifies itself by a metadata URL, sends the
-- person through the app's normal Google sign-in and an "Allow Claude?"
-- screen, and gets short-lived keys that only work for /api/mcp. Admins only.
--
-- No key is stored: codes and tokens are kept as SHA-256 hashes, so a copy of
-- these tables cannot be used to sign in. Server only: RLS on, no policies,
-- nothing granted to the browser roles.

create table if not exists public.mcp_oauth_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris text[] not null check (cardinality(redirect_uris) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_oauth_codes (
  code_hash text primary key,
  client_id text not null,
  user_id uuid not null,
  email text not null,
  redirect_uri text not null,
  code_challenge text not null,
  resource text not null,
  scope text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_oauth_tokens (
  token_hash text primary key,
  kind text not null check (kind in ('access', 'refresh')),
  -- Every token from one sign-in shares a family; reusing a spent refresh
  -- token (a sign of theft) revokes the whole family.
  family_id uuid not null,
  client_id text not null,
  user_id uuid not null,
  email text not null,
  resource text not null,
  scope text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mcp_oauth_tokens_family on public.mcp_oauth_tokens (family_id);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_oauth_tokens enable row level security;
revoke all on public.mcp_oauth_clients, public.mcp_oauth_codes, public.mcp_oauth_tokens from anon, authenticated;
