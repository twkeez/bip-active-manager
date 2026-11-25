-- Per-person section access (lib/auth/sections.ts).
--
-- An admin can open extra sidebar sections for a strategist on the Team page.
-- The sections they hold live here. Admins already reach everything, so the
-- column only matters for strategists.
--
-- Safe to run more than once. The app works before this is applied: it reads
-- "no grants" and the Team page says access can't be saved yet.
--
-- Who can change it: strategists may only update their own full_name (column
-- grant in 20260620120624_multi_user_access.sql), so nobody can grant
-- themselves a section. The Team page saves through an admin-only route.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS section_grants text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_section_grants_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_section_grants_check
  CHECK (section_grants <@ ARRAY['reporting', 'onboarding', 'playbook']::text[]);

COMMENT ON COLUMN public.profiles.section_grants IS
  'Sidebar sections an admin opened for this strategist, beyond Clients. See lib/auth/sections.ts.';
