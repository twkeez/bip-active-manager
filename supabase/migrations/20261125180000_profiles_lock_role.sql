-- Signed-in people can change only their own name on their profile.
--
-- 20260620120624_multi_user_access.sql granted UPDATE (full_name) to
-- authenticated, and its policy "profiles_update_own_name" lets a person update
-- their own row. But Supabase's default privileges also give authenticated
-- UPDATE on every column of every public table, and a column grant doesn't take
-- that away. Row security checks which row, not which column. So a strategist
-- holding their own session could set their own role to 'admin' through the
-- Supabase API, which the browser already talks to.
--
-- This takes table-wide INSERT, UPDATE and DELETE back from the browser roles
-- and grants back only what the app means to allow. Nothing in the app writes
-- profiles from the browser: the Team page saves through admin-only routes that
-- use the service key, and new accounts get their profile from the
-- handle_new_user() trigger, which runs as its owner. Safe to run more than once.
--
-- To check before and after (read-only):
--   select has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE');
-- true before, false after.

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
