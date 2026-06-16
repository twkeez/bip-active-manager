-- Idempotent: fixes "0 rows" when RLS is on but policies/grants were never applied.
-- Safe to run multiple times in the SQL Editor.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;

DROP POLICY IF EXISTS "clients_select_authenticated" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_authenticated" ON public.clients;
DROP POLICY IF EXISTS "clients_update_authenticated" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_authenticated" ON public.clients;

CREATE POLICY "clients_select_authenticated"
  ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "clients_insert_authenticated"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "clients_update_authenticated"
  ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "clients_delete_authenticated"
  ON public.clients FOR DELETE TO authenticated USING (true);
