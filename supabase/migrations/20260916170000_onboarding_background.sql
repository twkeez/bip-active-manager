-- Background the onboarding research reads, beyond the pipeline form.
--
-- Two sources Tom wants compiled automatically (2026-09-16): the kickoff doc
-- the website team gathers, and the client's Basecamp threads. Both are
-- summarised by Claude into plain background — practice facts, brand, goals,
-- what is in progress — and fed to the research scans alongside the pipeline
-- notes.
--
-- Only summaries are stored, never the raw documents or thread text. The
-- website team's Basecamp projects include threads for access codes, FTP
-- details and logins; those threads are skipped before reading, and anything
-- credential-shaped is removed both before and after summarising.

alter table public.client_onboarding_intake
  add column if not exists kickoff_doc_filename text,
  add column if not exists kickoff_doc_summary text,
  add column if not exists kickoff_doc_at timestamptz,
  add column if not exists basecamp_background text,
  add column if not exists basecamp_background_at timestamptz,
  add column if not exists basecamp_threads_read int;
