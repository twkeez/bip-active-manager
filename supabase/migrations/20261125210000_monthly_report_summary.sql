-- Monthly report summary: the strategist's note and next steps for one
-- client's report for one month (lib/reporting/month-summary.ts).
--
-- The AI can write a first draft, but nothing in these columns reaches the
-- client until a strategist approves it. summary_approved_at is set only by an
-- explicit approval in the app, and every save of new text clears it. The PDF,
-- Word export and report preview show the summary only when it is approved, and
-- the report can't be marked Reviewed or Sent while an unapproved summary is
-- waiting.
--
-- Safe to run more than once. Run 20261125200000_monthly_reports.sql first.

ALTER TABLE public.monthly_reports ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.monthly_reports ADD COLUMN IF NOT EXISTS recommendations jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.monthly_reports ADD COLUMN IF NOT EXISTS summary_ai_drafted boolean NOT NULL DEFAULT false;
ALTER TABLE public.monthly_reports ADD COLUMN IF NOT EXISTS summary_updated_at timestamptz;
ALTER TABLE public.monthly_reports ADD COLUMN IF NOT EXISTS summary_updated_by uuid REFERENCES auth.users(id);
ALTER TABLE public.monthly_reports ADD COLUMN IF NOT EXISTS summary_approved_at timestamptz;
ALTER TABLE public.monthly_reports ADD COLUMN IF NOT EXISTS summary_approved_by uuid REFERENCES auth.users(id);

ALTER TABLE public.monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_recommendations_check;
ALTER TABLE public.monthly_reports ADD CONSTRAINT monthly_reports_recommendations_check
  CHECK (jsonb_typeof(recommendations) = 'array');

-- An approval names who gave it.
ALTER TABLE public.monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_summary_approval_check;
ALTER TABLE public.monthly_reports ADD CONSTRAINT monthly_reports_summary_approval_check
  CHECK ((summary_approved_at IS NULL) = (summary_approved_by IS NULL));

-- The database itself refuses Reviewed or Sent while a summary waits for
-- approval, whichever screen or route tries it.
ALTER TABLE public.monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_summary_approved_before_review_check;
ALTER TABLE public.monthly_reports ADD CONSTRAINT monthly_reports_summary_approved_before_review_check
  CHECK (
    status = 'draft'
    OR summary_approved_at IS NOT NULL
    OR (coalesce(btrim(summary), '') = '' AND jsonb_array_length(recommendations) = 0)
  );

COMMENT ON COLUMN public.monthly_reports.summary_approved_at IS
  'When a strategist approved the summary and next steps for the client. Null = not approved: kept out of every export.';
