-- Client Watch: where each Master Sheet client stands, read from its Basecamp
-- threads (lib/client-watch). Tom, Nov 25 2026: Client Watch should show what
-- the client status sheet shows, kept up to date inside the app.
--
-- One row per read. A read is Claude going through one client's Basecamp
-- posts and writing down what we owe, where things stand, open asks, our
-- commitments, the latest report seen, flags and a recommended next action.
-- Reads are added, never changed or deleted, so there is a history.
-- client_watch_latest is the newest good read per client;
-- client_watch_last_attempt is the newest read of any kind, so a failed read
-- shows up instead of hiding behind an older one.
--
-- Internal only, never shown to clients. Admins can read it; nobody writes it
-- from the browser: the scheduled refresh and the Re-read button write with
-- the server's own key, after checking the person is an admin.
--
-- Safe to run more than once. Until it is run, the Client Watch page says the
-- table is missing and the refresh does nothing.

CREATE TABLE IF NOT EXISTS public.client_watch_reads (
  id                   bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id            bigint      NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  read_at              timestamptz NOT NULL DEFAULT now(),
  -- Which instructions and model wrote it; a change to either re-reads everyone.
  prompt_version       text        NOT NULL,
  model                text        NOT NULL,
  window_days          integer     NOT NULL,
  threads_read         integer     NOT NULL DEFAULT 0,
  posts_read           integer     NOT NULL DEFAULT 0,
  posts_without_words  integer     NOT NULL DEFAULT 0,
  -- The newest Basecamp post this read saw. A newer post means it's due again.
  newest_post_at       timestamptz,
  cost_usd             numeric(10, 4),
  owe_response         text,
  what_we_owe          text,
  where_things_stand   text,
  open_asks            text,
  our_commitments      text,
  other_threads        text,
  -- 'YYYY-MM' of the latest monthly report seen in the threads, or null.
  latest_report_month  text,
  next_action          text,
  flags                text[]      NOT NULL DEFAULT '{}',
  unhappy              boolean     NOT NULL DEFAULT false,
  most_recent_thread   text,
  read_notes           text,
  -- Set when the read failed; the other answers are then empty.
  error                text
);

ALTER TABLE public.client_watch_reads DROP CONSTRAINT IF EXISTS client_watch_reads_owe_check;
ALTER TABLE public.client_watch_reads ADD CONSTRAINT client_watch_reads_owe_check
  CHECK (owe_response IS NULL OR owe_response IN ('yes', 'no', 'thanks_only'));

ALTER TABLE public.client_watch_reads DROP CONSTRAINT IF EXISTS client_watch_reads_report_month_check;
ALTER TABLE public.client_watch_reads ADD CONSTRAINT client_watch_reads_report_month_check
  CHECK (latest_report_month IS NULL OR latest_report_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

CREATE INDEX IF NOT EXISTS client_watch_reads_client_idx
  ON public.client_watch_reads (client_id, read_at DESC, id DESC);

ALTER TABLE public.client_watch_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.client_watch_reads FROM anon, authenticated;
GRANT SELECT ON public.client_watch_reads TO authenticated;

DROP POLICY IF EXISTS "client_watch_reads_select_admin" ON public.client_watch_reads;
CREATE POLICY "client_watch_reads_select_admin" ON public.client_watch_reads
  FOR SELECT TO authenticated
  USING (public.user_role() = 'admin');

-- The views run with the reader's own rules, so only admins see rows.
CREATE OR REPLACE VIEW public.client_watch_latest
WITH (security_invoker = on) AS
SELECT DISTINCT ON (client_id) *
FROM public.client_watch_reads
WHERE error IS NULL
ORDER BY client_id, read_at DESC, id DESC;

CREATE OR REPLACE VIEW public.client_watch_last_attempt
WITH (security_invoker = on) AS
SELECT DISTINCT ON (client_id) *
FROM public.client_watch_reads
ORDER BY client_id, read_at DESC, id DESC;

REVOKE ALL ON public.client_watch_latest, public.client_watch_last_attempt FROM anon, authenticated;
GRANT SELECT ON public.client_watch_latest, public.client_watch_last_attempt TO authenticated;
