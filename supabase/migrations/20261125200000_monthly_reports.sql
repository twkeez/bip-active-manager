-- Monthly reports: where each client's report stands for each month
-- (lib/reporting/monthly.ts).
--
-- One row per client and month, created the first time someone starts that
-- month's report. No row means "Not started". The row says Draft, Reviewed or
-- Sent, who moved it last and when, and how a sent report reached the client.
--
-- Who can see and change a row: whoever can see the client. That is the
-- clients table's own rule (20260623120000_client_multi_strategist.sql):
-- admins see every client, a strategist sees the clients assigned to them. So
-- a strategist's Reporting list holds only their own clients, and nobody can
-- mark another person's client as sent. Rows are never deleted from the app.
--
-- Safe to run more than once. The app works before this is applied: the
-- Reporting page lists the clients and says states can't be saved yet.

CREATE TABLE IF NOT EXISTS public.monthly_reports (
  client_id   bigint      NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month       date        NOT NULL,
  status      text        NOT NULL,
  sent_via    text[]      NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        REFERENCES auth.users(id),
  reviewed_at timestamptz,
  reviewed_by uuid        REFERENCES auth.users(id),
  sent_at     timestamptz,
  sent_by     uuid        REFERENCES auth.users(id),
  PRIMARY KEY (client_id, month)
);

ALTER TABLE public.monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_month_check;
ALTER TABLE public.monthly_reports ADD CONSTRAINT monthly_reports_month_check
  CHECK (month = date_trunc('month', month)::date);

ALTER TABLE public.monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_status_check;
ALTER TABLE public.monthly_reports ADD CONSTRAINT monthly_reports_status_check
  CHECK (status IN ('draft', 'reviewed', 'sent'));

ALTER TABLE public.monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_sent_via_check;
ALTER TABLE public.monthly_reports ADD CONSTRAINT monthly_reports_sent_via_check
  CHECK (sent_via <@ ARRAY['snapshot', 'pdf', 'word', 'other']::text[]);

-- A sent report says how it went out.
ALTER TABLE public.monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_sent_has_via_check;
ALTER TABLE public.monthly_reports ADD CONSTRAINT monthly_reports_sent_has_via_check
  CHECK (status <> 'sent' OR cardinality(sent_via) > 0);

CREATE INDEX IF NOT EXISTS monthly_reports_month_idx ON public.monthly_reports (month);

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

-- The subquery reads clients under the caller's own rules, so it finds the
-- client only when the caller may see it.
DROP POLICY IF EXISTS "monthly_reports_select_visible_client" ON public.monthly_reports;
CREATE POLICY "monthly_reports_select_visible_client" ON public.monthly_reports
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = monthly_reports.client_id));

DROP POLICY IF EXISTS "monthly_reports_insert_visible_client" ON public.monthly_reports;
CREATE POLICY "monthly_reports_insert_visible_client" ON public.monthly_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    updated_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = monthly_reports.client_id)
  );

DROP POLICY IF EXISTS "monthly_reports_update_visible_client" ON public.monthly_reports;
CREATE POLICY "monthly_reports_update_visible_client" ON public.monthly_reports
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = monthly_reports.client_id))
  WITH CHECK (
    updated_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = monthly_reports.client_id)
  );

COMMENT ON TABLE public.monthly_reports IS
  'Where each client''s monthly report stands: draft, reviewed or sent. No row = not started. See lib/reporting/monthly.ts.';
