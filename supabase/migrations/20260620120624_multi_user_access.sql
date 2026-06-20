-- ============================================================
-- Multi-user access: profiles, roles, scoped RLS
-- Each strategist sees only their assigned clients and tasks.
-- ============================================================

-- -------------------------------------------------------
-- 1. Profiles table (handles existing partial setup)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text        NOT NULL,
  role       text        NOT NULL DEFAULT 'strategist',
  full_name  text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add updated_at if it doesn't exist yet
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Fix the role constraint: drop old one, update data, then add correct one
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- Update any rows that used the old 'staff' role value
UPDATE public.profiles SET role = 'strategist' WHERE role = 'staff';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'strategist'));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

-- -------------------------------------------------------
-- 2. Security-definer role helper
-- Bypasses RLS when reading profiles — prevents recursion.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;

-- -------------------------------------------------------
-- 3. Profiles RLS
-- -------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_if_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_name" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all"        ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_if_admin"
  ON public.profiles FOR SELECT
  USING (public.user_role() = 'admin');

CREATE POLICY "profiles_update_own_name"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- -------------------------------------------------------
-- 4. Auto-create profile on new user signup
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'strategist'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------
-- 5. Seed / update existing users in profiles
-- -------------------------------------------------------
-- Update existing partial rows (role was 'staff', full_name was NULL)
UPDATE public.profiles
  SET role = 'strategist', full_name = 'Alex'
  WHERE id = '459c815a-94f8-4336-8da9-4f579d4717b1';

UPDATE public.profiles
  SET role = 'strategist', full_name = 'Stephanie'
  WHERE id = '0bb7b301-7e70-4ffe-8466-a00ac674b2d9';

-- Insert Tom if not already there
INSERT INTO public.profiles (id, email, full_name, role) VALUES
  ('200d30ed-1b18-4f98-80fb-910d5d249282', 'tom@beyondindigo.com', 'Tom', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'Tom';

-- -------------------------------------------------------
-- 6. Add strategist_user_id to clients
-- -------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS strategist_user_id uuid REFERENCES auth.users(id);

-- Populate for existing single-name strategists where user already exists
UPDATE public.clients SET strategist_user_id = '459c815a-94f8-4336-8da9-4f579d4717b1'
  WHERE marketing_strategist = 'Alex';

UPDATE public.clients SET strategist_user_id = '0bb7b301-7e70-4ffe-8466-a00ac674b2d9'
  WHERE marketing_strategist = 'Stephanie';

UPDATE public.clients SET strategist_user_id = '200d30ed-1b18-4f98-80fb-910d5d249282'
  WHERE marketing_strategist = 'Tom';

-- -------------------------------------------------------
-- 7. Update clients RLS: admins see all, strategists see assigned
-- -------------------------------------------------------
DROP POLICY IF EXISTS "clients_select_authenticated" ON public.clients;
CREATE POLICY "clients_select_authenticated" ON public.clients FOR SELECT
  USING (
    public.user_role() = 'admin'
    OR strategist_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "clients_update_authenticated" ON public.clients;
CREATE POLICY "clients_update_authenticated" ON public.clients FOR UPDATE
  USING (
    public.user_role() = 'admin'
    OR strategist_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "clients_insert_authenticated" ON public.clients;
CREATE POLICY "clients_insert_authenticated" ON public.clients FOR INSERT
  WITH CHECK (public.user_role() = 'admin');

DROP POLICY IF EXISTS "clients_delete_authenticated" ON public.clients;
CREATE POLICY "clients_delete_authenticated" ON public.clients FOR DELETE
  USING (public.user_role() = 'admin');

-- -------------------------------------------------------
-- 8. Add user_id link to user_task_people
-- Links a person record to an auth user so a strategist
-- can see tasks assigned to them.
-- -------------------------------------------------------
ALTER TABLE public.user_task_people
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Link Tom's existing person records to their auth users
UPDATE public.user_task_people
  SET user_id = '459c815a-94f8-4336-8da9-4f579d4717b1'
  WHERE owner_user_id = '200d30ed-1b18-4f98-80fb-910d5d249282'
    AND name = 'Alex';

UPDATE public.user_task_people
  SET user_id = '0bb7b301-7e70-4ffe-8466-a00ac674b2d9'
  WHERE owner_user_id = '200d30ed-1b18-4f98-80fb-910d5d249282'
    AND name = 'Stephanie';

-- Allow users to see the person record linked to their account
DROP POLICY IF EXISTS "user_task_people_select_self" ON public.user_task_people;
CREATE POLICY "user_task_people_select_self"
  ON public.user_task_people FOR SELECT
  USING (user_id = auth.uid());

-- -------------------------------------------------------
-- 9. user_task_assignees: let strategists see their assignments
-- -------------------------------------------------------
DROP POLICY IF EXISTS "user_task_assignees_select_own" ON public.user_task_assignees;
CREATE POLICY "user_task_assignees_select_own" ON public.user_task_assignees FOR SELECT
  USING (
    owner_user_id = auth.uid()
    OR person_id IN (
      SELECT id FROM public.user_task_people WHERE user_id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- 10. user_tasks: strategists can see/update tasks assigned to them
-- -------------------------------------------------------
DROP POLICY IF EXISTS "user_tasks_select_own" ON public.user_tasks;
CREATE POLICY "user_tasks_select_own" ON public.user_tasks FOR SELECT
  USING (
    owner_user_id = auth.uid()
    OR id IN (
      SELECT ta.task_id
      FROM public.user_task_assignees ta
      JOIN public.user_task_people p ON ta.person_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "user_tasks_update_own" ON public.user_tasks;
CREATE POLICY "user_tasks_update_own" ON public.user_tasks FOR UPDATE
  USING (
    owner_user_id = auth.uid()
    OR id IN (
      SELECT ta.task_id
      FROM public.user_task_assignees ta
      JOIN public.user_task_people p ON ta.person_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- 11. Task activity: let strategists read activity on their tasks
-- -------------------------------------------------------
DROP POLICY IF EXISTS "user_task_activity_select_own" ON public.user_task_activity;
CREATE POLICY "user_task_activity_select_own" ON public.user_task_activity FOR SELECT
  USING (
    owner_user_id = auth.uid()
    OR task_id IN (
      SELECT ta.task_id FROM public.user_task_assignees ta
      JOIN public.user_task_people p ON ta.person_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- 12. client_keyword_targets: access based on client assignment
-- -------------------------------------------------------
DROP POLICY IF EXISTS "client_keyword_targets_select_own" ON public.client_keyword_targets;
CREATE POLICY "client_keyword_targets_select_own" ON public.client_keyword_targets FOR SELECT
  USING (
    owner_user_id = auth.uid()
    OR client_id IN (
      SELECT id FROM public.clients WHERE strategist_user_id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- 13. report_template_config: restrict writes to admins only
-- SELECT stays open (all authenticated can read the master template).
-- -------------------------------------------------------
DROP POLICY IF EXISTS "auth users can upsert template config" ON public.report_template_config;
DROP POLICY IF EXISTS "template_config_write_admin_only"     ON public.report_template_config;
CREATE POLICY "template_config_write_admin_only"
  ON public.report_template_config FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');
