-- Editable content for the Services & Tiers and Partnership & Boundaries pages.
-- One row per section (key = 'tiers' | 'partnership'), holding the structured
-- content as JSON. Team-readable; admins edit through an admin-gated API route
-- (service role), so no broad write policy is granted. When a key is absent, the
-- app falls back to the code-level default, so this seeds itself on first save.

create table if not exists public.service_content (
  content_key text primary key check (char_length(trim(content_key)) > 0),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

grant select on public.service_content to authenticated;

alter table public.service_content enable row level security;

create policy "service_content_select_authenticated"
  on public.service_content for select to authenticated using (true);
