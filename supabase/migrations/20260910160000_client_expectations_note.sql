-- A short note from the strategist, printed after the intro of a client's
-- expectations document.
--
-- Everything else in that document is master copy shared by every client. This
-- is the one part written for the practice itself — two or three sentences on
-- what the strategist will focus on first and why — and the part a client can
-- tell a person wrote. Optional; editable by anyone who can open the client,
-- team included.

alter table public.clients
  add column if not exists expectations_note text;

comment on column public.clients.expectations_note is
  'Strategist''s note for this client, printed after the intro of their expectations document.';
