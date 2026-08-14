-- Records when a report was last actually produced for a client.
--
-- Nothing tracked this before: report_drafts.updated_at only says when someone
-- last edited a draft, and the PDF/print path wrote nothing at all. This column
-- is stamped by the two real "a report went out" surfaces — the Word export
-- route and the chrome-free print view — so the client overview page can show
-- "Last report — Jul 30 · 45 days ago" and flag clients past the monthly mark.
--
-- Starts NULL for every client and fills in going forward.

alter table public.clients
  add column if not exists last_report_run_at timestamptz;

comment on column public.clients.last_report_run_at is
  'When a report was last produced for this client (Word export or print view). NULL = never.';
