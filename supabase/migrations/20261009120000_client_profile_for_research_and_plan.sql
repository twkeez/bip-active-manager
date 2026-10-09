-- Client facts the research and the "Your Marketing Plan & Expectations"
-- document need, found missing on Remedy Veterinary Urgent Care (client 303,
-- 2026-10-09):
--
--   street_address, zip   research only had the town ("Parkville"), and got
--                         Parkville, MISSOURI; with the state it now also gets
--                         the street and ZIP.
--   practice_type         research and wording assumed every client is a
--                         general practice; for an urgent care, GPs are
--                         referral partners and the competitors are other
--                         urgent cares and ERs.
--   ad_budget_monthly     the agreed Google Ads spend, e.g. "$400–$700"; when
--                         set, the plan quotes it instead of the house range.
--   conversion_types      what counts as a lead for this practice (no online
--                         booking at Remedy: calls and walk-ins).
--   practice_opening_date for new practices: Google Ads can start "at practice
--                         opening" instead of at the splash page.
--   website_stage         replaces the on/off "awaiting launch" switch, which
--                         nothing set, so every client read "Launched".
--
-- Every column starts empty: a client with nothing filled in reads exactly as
-- before. No existing data is changed.

alter table public.clients
  add column if not exists street_address text,
  add column if not exists zip text,
  add column if not exists practice_type text
    check (practice_type in ('general_practice', 'urgent_care', 'emergency_24h', 'specialty', 'mobile', 'other')),
  add column if not exists ad_budget_monthly text,
  add column if not exists conversion_types text[]
    check (conversion_types <@ array['phone_calls', 'walk_ins', 'directions', 'online_booking', 'forms']::text[]),
  add column if not exists practice_opening_date date,
  add column if not exists website_stage text
    check (website_stage in ('not_started', 'building', 'splash_live', 'launched'));

comment on column public.clients.practice_type is 'general_practice | urgent_care | emergency_24h | specialty | mobile | other. Empty reads as a general practice, as before.';
comment on column public.clients.website_stage is 'not_started | building | splash_live | launched. Empty: falls back to awaiting_website_launch (false = launched).';
