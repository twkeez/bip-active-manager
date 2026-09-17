-- "When not to panic — and when to tell us": the two halves of when to worry.
--
-- The document already sets expectations for what each service will do. What it
-- never said is which normal wobbles — a ranking slipping two places, a quiet
-- week, a single bad review — are not worth a phone call, and which things we
-- genuinely want to hear about the day they happen. Saying both in writing at
-- kickoff is what prevents the month-two panic, and the month-six surprise
-- where a practice sat on a suspended Google listing for weeks.
--
-- Master copy, like every other block: editable at /client-expectations, and
-- rewordable per client in the document editor. The insert leaves any existing
-- wording alone, so re-running this cannot overwrite an edit.

insert into public.service_expectation_blocks (block_key, body, sort_order)
values (
  'reassure_normal',
  'Marketing moves around week to week, and most of that movement means nothing on its own. These are normal, and we would only act on them if they carried on:' || chr(10) ||
  '• Rankings that move a few places up or down, or look different on your phone than on someone else''s computer.' || chr(10) ||
  '• A quiet week for calls or form fills. Holidays, school breaks and bad weather all show up in the numbers.' || chr(10) ||
  '• Ad costs that vary day to day. We judge a campaign by the month, not the day.' || chr(10) ||
  '• A post that gets fewer likes than the last one.' || chr(10) ||
  '• One bad review among good ones. Answering it well matters more than the review itself.' || chr(10) ||
  'If something looks off to you, ask. You will never be wasting our time, and a question is easier to answer than a worry.',
  0
)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';

insert into public.service_expectation_blocks (block_key, body, sort_order)
values (
  'reassure_alert',
  'Tell us as soon as you can if:' || chr(10) ||
  '• Your phone line or website is down, or your hours change.' || chr(10) ||
  '• Your Google listing shows the wrong hours, phone number or address, or Google suspends it.' || chr(10) ||
  '• A doctor or team member joins or leaves, or you start or stop offering a service.' || chr(10) ||
  '• A review needs a reply you would like help with, or one looks fake.' || chr(10) ||
  '• You get a run of calls that are not real clients — sales calls, spam, or people far outside your area.' || chr(10) ||
  '• Anything on your website is wrong or out of date.' || chr(10) ||
  '• You have something worth telling people about: a promotion, an event, new equipment, a new doctor.' || chr(10) ||
  'We watch for most of this from our side and will usually catch it, but you will see some of it first — and the sooner we know, the less time it costs you.',
  0
)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';
