-- The words of each Basecamp post, so Poobah Client Watch (and Claude through
-- its connector) can see what clients are asking for, not only that they
-- posted (Tom, 2026-09-29: "keep track of clients, what they might be looking
-- for or need done").
--
-- Credential-safe, like onboarding background (lib/onboarding/background-safety.ts):
-- posts in threads named for access/logins are never stored (post_text stays
-- null, post_text_withheld = 'access_thread'), and any line that looks like a
-- password, login or key is removed before saving (counted in
-- post_text_redacted_lines).

alter table public.basecamp_communication_events
  add column if not exists post_text text,
  add column if not exists post_text_redacted_lines integer,
  add column if not exists post_text_withheld text,
  add column if not exists author_name text;
