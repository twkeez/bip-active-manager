-- Reusable client-request messages for celebration days and weeks.
--
-- Some awareness days need something FROM the client before we can post — photos,
-- names, credentials, a quote. Those asks are the same every year apart from the
-- dates, so the message lives here as a template beside the date rule that
-- already knows when the event falls.
--
-- The template carries placeholders rather than literal dates, so the annual
-- review is about confirming the date rule and source, not rewriting prose:
--
--   {{date_range}}  the event's dates for the year, e.g. "October 18–24"
--   {{respond_by}}  the reply deadline, e.g. "Friday, September 25"
--   {{year}}        the calendar year
--
-- Rendered by lib/social/client-request-message.ts, which derives both dates
-- from the existing rule via resolveAwarenessDate().

alter table public.social_awareness_days
  add column if not exists client_request_template text;

-- How many days before the event starts the client's reply is due. Null means
-- the day has no client ask, which is most of them.
alter table public.social_awareness_days
  add column if not exists request_respond_by_days smallint
  check (request_respond_by_days is null or request_respond_by_days between 1 and 180);

comment on column public.social_awareness_days.client_request_template is
  'Reusable message asking the client for what we need. Supports {{date_range}}, {{respond_by}} and {{year}}.';

comment on column public.social_awareness_days.request_respond_by_days is
  'Days before the event start that the client reply is due; drives {{respond_by}}.';

-- ── National Veterinary Technician Week ──────────────────────────────────────
-- Third full week of October (already stored as week_of, nth=3, weekday=0,
-- duration 7). 23 days before the Sunday start always lands on a Friday, which
-- is where the "Friday, September 25" deadline comes from.

update public.social_awareness_days
set
  request_respond_by_days = 23,
  client_request_template = $msg$National Veterinary Technician Week is {{date_range}}, and we're excited to highlight your techs on social media! Pet owners love seeing the team behind their pets' care, making this one of the best engagement weeks of the year.

Our thought this year was to give you a few options to highlight on social media, depending on how much time you have for it.

Pick the option below that best fits your schedule. If we don't hear back by {{respond_by}}, we'll automatically run Option 1.

Option 1 — We handle it (0 mins required): A custom-branded thank-you graphic celebrating your tech team. Zero prep needed on your end.

Option 2 — Team photo (~5 mins): Send one group photo and your techs' first names.

Option 3 — Team spotlight series (~20–30 mins): An individual spotlight post for each technician across the week. For each participating tech, please send:
- Name (as preferred online) and exact credential (CVT, LVT, RVT — per NAVTA guidelines)
- Years with the practice
- A well-lit photo in scrubs, at work, or with a patient (with client permission)

Extra mile items for consideration:
- 1–2 appreciation sentences from the doctor(s)
- A video of the tech giving a short answer to ONE prompt: why they became a tech, favorite part of the job, or a note about their own pets (portrait mode)

How to send: reply to this message with your option choice and photos.

Thanks for helping us celebrate your team — they deserve the spotlight!$msg$
where name = 'National Veterinary Technician Week';
