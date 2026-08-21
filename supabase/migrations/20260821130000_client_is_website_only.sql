-- Move "Website Only" off the free-text `tier` column onto its own flag.
--
-- Companion to 20260821120000_client_is_low_contact.sql. These accounts are
-- hidden from the client lists behind a "show website-only clients" toggle, and
-- there are 154 of 248 of them — so clearing `tier` without this would dump the
-- majority of the book into the default client view.
--
-- The match is exact and case-sensitive on purpose: it mirrors the comparison
-- the app used, so a client whose tier reads "website only" was never hidden and
-- must not start being hidden now.
--
-- Safe to run before the matching code deploys: the app falls back to the old
-- tier text until the column exists.

alter table clients
  add column if not exists is_website_only boolean not null default false;

comment on column clients.is_website_only is
  'Website-build-only account, hidden from client lists behind a toggle. Replaces tier = ''Website Only''.';

update clients
set is_website_only = true
where tier = 'Website Only';
