-- Tier-specific "What to expect", a shorter glossary, and a plainer voice.
--
-- Written after reading a real document sent to Q1 Veterinary Hospital. Three
-- problems, in order of cost:
--
-- 1. It promised work Q1 had not bought. On SEO Foundation it said we would
--    "optimize your priority pages" (Premium); on PPC Foundation, "refine bids,
--    budgets, and targeting" (Premium's testing). The tier copy below is drawn
--    from the published scope tables in lib/services/tier-content.ts, and
--    promises nothing missing from a tier's list. Reputation gets none: it has
--    no written scope, and inventing one is the problem being fixed.
-- 2. The glossary was 2.5 of 6 pages. Cut from 33 terms to 10, keeping the ones
--    a client meets in "What we need" or in their reports. "Backlink" is gone:
--    no tier includes link building, and defining it invited the question.
-- 3. It read as machine-written. The intro, closing, shared "What to expect"
--    fallbacks and every "What this isn't" are rewritten: shorter sentences, no
--    stock phrases, one spelling standard (US). Tom's "What we need",
--    recommendations and timetable are left as he wrote them.
--
-- Both tables are copied first, because this overwrites text.

create table if not exists public.service_expectation_blocks_backup_20260910 as
  select * from public.service_expectation_blocks;
alter table public.service_expectation_blocks_backup_20260910 enable row level security;

create table if not exists public.expectation_glossary_backup_20260910 as
  select * from public.expectation_glossary;
alter table public.expectation_glossary_backup_20260910 enable row level security;

-- 1. Tier-specific "What to expect". Fills a tier only while it is empty, so
--    anything written in the editor before this runs is kept.

insert into public.service_expectation_blocks (block_key, body, sort_order)
values ('seo_expect_foundation', 'In your first month we connect Google Search Console, Google Analytics and Tag Manager, claim and tidy up your Google Business Profile, submit your sitemap to Google, and rewrite your page titles and descriptions. After that, we check your Google listing, titles and sitemap every month, keep your practice details consistent across the web, and run a full site audit twice a year. Most practices see more people finding their Google listing within a few months. How far that goes depends a lot on your reviews and on how competitive {{city}} is.', 0)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';

insert into public.service_expectation_blocks (block_key, body, sort_order)
values ('seo_expect_premium', 'In your first month we connect Google Search Console, Google Analytics and Tag Manager, claim and tidy up your Google Business Profile, submit your sitemap, and rewrite your page titles and descriptions. We also start tracking where you rank for your most important searches, and how you compare with nearby practices. After that, each month we improve a few of your pages, review your rankings, and post to your Google Business Profile. We audit the whole site every quarter, and you''ll have your own reporting dashboard. Expect ranking movement on your main searches within three to six months. Busier services in {{city}} can take longer.', 0)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';

insert into public.service_expectation_blocks (block_key, body, sort_order)
values ('seo_expect_premium_plus', 'In your first month we connect Google Search Console, Google Analytics and Tag Manager, claim and tidy up your Google Business Profile, submit your sitemap, and rewrite your page titles and descriptions. We track your rankings locally and across the wider region, and against nearby practices. Each month we improve your pages, review your rankings, post to your Google Business Profile, and publish an SEO blog post. We also identify and improve pages for your specialty services, and prepare your site to be picked up by AI search tools like ChatGPT and Google''s AI answers. We audit the whole site every quarter, and you''ll have your own reporting dashboard. Expect movement on local searches within three to six months, and on wider regional searches over a longer stretch.', 0)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';

insert into public.service_expectation_blocks (block_key, body, sort_order)
values ('ppc_expect_foundation', 'We run one campaign for you on one channel, usually Google Search. First we review your existing ad account or build a new one, set up tracking so we can see which clicks turn into calls, and research the searches worth paying for. After that we manage the campaign and adjust bids as needed. You pay Google directly for the ads themselves, separately from our fee. Most campaigns settle within the first few weeks, once Google has learned which searches lead to calls.', 0)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';

insert into public.service_expectation_blocks (block_key, body, sort_order)
values ('ppc_expect_premium', 'We run ads for you on up to three platforms, typically Google and Facebook or Instagram, using more than one type of campaign. We set up tracking so we can see which ads lead to calls, research your searches and audiences in depth, and block searches that would waste your budget. Each month we adjust bids and budgets, and test new ad copy and images against what''s already running. You pay the platforms directly for the ads, separately from our fee. Give it a few weeks to settle before judging the numbers.', 0)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';

insert into public.service_expectation_blocks (block_key, body, sort_order)
values ('ppc_expect_premium_plus', 'We run a full program across Google (Search, Display and Performance Max) and up to three social platforms, covering up to three locations or service lines. That includes remarketing, so people who have visited your site see your ads again. Each month we adjust bids and budgets, test ad copy, images and audiences, and suggest changes to the pages your ads send people to. You pay the platforms directly for the ads, separately from our fee. Give it a few weeks to settle before judging results. The larger the program, the more Google has to learn.', 0)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';

insert into public.service_expectation_blocks (block_key, body, sort_order)
values ('smm_expect_foundation', 'We create five posts a month for Facebook, Instagram and your Google Business Profile, with a consistent look for your practice. Your team publishes them, and we keep an eye on comments and messages so you know when something needs a reply. That steady presence builds familiarity with local pet owners over time.', 0)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';

insert into public.service_expectation_blocks (block_key, body, sort_order)
values ('smm_expect_premium', 'We create and schedule ten posts a month for Facebook, Instagram and your Google Business Profile, plus one more platform, with custom graphics for your practice. You''ll see each month''s calendar ahead of time to approve, and if you have a blog with us, we share each new post. We watch comments and messages and let you know when something needs a reply.', 0)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';

insert into public.service_expectation_blocks (block_key, body, sort_order)
values ('smm_expect_premium_plus', 'We run your social media on up to three platforms, including a short-form video channel such as Instagram Reels, TikTok or YouTube Shorts. That''s around sixteen posts a month plus short videos and Stories, organized into seasonal campaigns we plan with you each quarter. We also reply to comments and messages on your behalf, and pass anything that needs a clinical answer to your team.', 0)
on conflict (block_key) do update set body = excluded.body, updated_at = now()
  where public.service_expectation_blocks.body = '';


-- 2. Glossary: drop the 23 seeded terms not kept, then rewrite the ten that are.

delete from public.expectation_glossary where lower(term) in (
  'organic results',
  'paid results',
  'local seo',
  'on-page seo',
  'technical seo',
  'structured data',
  'nap consistency',
  'citation',
  'backlink',
  'indexing',
  'core web vitals',
  'landing page',
  'click-through rate (ctr)',
  'impression share',
  'quality score',
  'cost per click (cpc)',
  'negative keyword',
  'engagement',
  'organic vs boosted',
  'evergreen content',
  'internal linking',
  'review velocity',
  'review response'
);

update public.expectation_glossary set definition = 'Your free listing on Google Search and Google Maps, with your hours, phone number, photos and reviews. For many practices it drives more calls than the website, so it''s where we start.', services = '{seo,orm}', sort_order = 10, updated_at = now()
  where lower(term) = 'google business profile';

update public.expectation_glossary set definition = 'The three local practices Google shows on a map above the regular results. For searches like "vet near me," that''s where most new clients look.', services = '{seo}', sort_order = 20, updated_at = now()
  where lower(term) = 'map pack';

update public.expectation_glossary set definition = 'A free Google tool that shows which searches your practice appears for and how often people click through. Most of the numbers in your SEO reports come from it.', services = '{seo}', sort_order = 30, updated_at = now()
  where lower(term) = 'search console';

update public.expectation_glossary set definition = 'A word or phrase someone types into Google, such as "emergency vet in {{city}}."', services = '{seo,ppc}', sort_order = 40, updated_at = now()
  where lower(term) = 'keyword';

update public.expectation_glossary set definition = 'How many times your listing or ad was shown. Impressions usually rise before calls do, so an early increase is a good sign.', services = '{}', sort_order = 50, updated_at = now()
  where lower(term) = 'impressions';

update public.expectation_glossary set definition = 'How many times someone clicked your listing or ad. The gap between impressions and clicks tells us how appealing your listing looks.', services = '{}', sort_order = 60, updated_at = now()
  where lower(term) = 'clicks';

update public.expectation_glossary set definition = 'A visit that turned into something useful, like a phone call, a booking or a form. It''s the number that matters most.', services = '{}', sort_order = 70, updated_at = now()
  where lower(term) = 'conversion';

update public.expectation_glossary set definition = 'The first few weeks of a new ad campaign, while Google works out which searches lead to calls. Results swing during this time, and big changes restart it.', services = '{ppc}', sort_order = 80, updated_at = now()
  where lower(term) = 'learning period';

update public.expectation_glossary set definition = 'What you paid in ads for each call or booking. It''s the clearest way to judge whether the ads are worth it.', services = '{ppc}', sort_order = 90, updated_at = now()
  where lower(term) = 'cost per conversion';

update public.expectation_glossary set definition = 'How many people saw a post. Most posts reach only some of your followers, which is normal.', services = '{smm}', sort_order = 100, updated_at = now()
  where lower(term) = 'reach';


-- 3. Voice. Overwrites; the backup above holds the previous text.

update public.service_expectation_blocks set body = 'Welcome to Beyond Indigo, {{client_name}}. This document covers your first 90 days with us: what we''ll be doing, what we need from you to get started, and what to realistically expect from each service. {{strategist}} will go through it with you at kickoff, so bring any questions.', updated_at = now() where block_key = 'intro';

update public.service_expectation_blocks set body = 'That''s the plan for your first 90 days. When we need something from you, we''ll ask clearly and give you time to get it to us. If anything here doesn''t match what you expected, tell us at kickoff and we''ll sort it out.

{{strategist}} · Beyond Indigo Pets', updated_at = now() where block_key = 'closing';

update public.service_expectation_blocks set body = 'SEO builds over time. We start with the technical basics and your Google Business Profile, then keep your site and listing in good shape month to month. Most practices see more people finding them on Google within a few months. How quickly depends on your plan, your reviews, and how competitive {{city}} is.', updated_at = now() where block_key = 'seo_expect';

update public.service_expectation_blocks set body = 'Ads can start bringing in calls within the first few weeks. After a short learning period, we adjust the campaign based on which searches and ads lead to calls and bookings.', updated_at = now() where block_key = 'ppc_expect';

update public.service_expectation_blocks set body = 'We keep your social accounts active with regular posts in a consistent style for your practice. Familiarity with local pet owners builds steadily over the months.', updated_at = now() where block_key = 'smm_expect';

update public.service_expectation_blocks set body = 'We write articles about the questions pet owners in {{city}} are searching for, published on a regular schedule. Over time they build into a library that brings people to your site.', updated_at = now() where block_key = 'blog_expect';

update public.service_expectation_blocks set body = 'We monitor your reviews on Google and the main directories, help you reply to them, and help your team ask happy clients for reviews so new ones keep coming in.', updated_at = now() where block_key = 'orm_expect';

update public.service_expectation_blocks set body = 'We can''t guarantee rankings, and no one honestly can. Google decides, and it weighs things outside our control, like your reviews and what nearby practices are doing. SEO also takes time. You''ll usually see more people viewing your listing before you see more calls.', updated_at = now() where block_key = 'seo_limits';

update public.service_expectation_blocks set body = 'Ads bring people to your website or your phone. Whether they book depends on what happens next, so if the ads are working and the bookings aren''t following, we''ll tell you. Results stop when the ad budget does. And the cost of each click moves with competition and the season, so we''ll let you know whether a rise is something we can fix or just the market.', updated_at = now() where block_key = 'ppc_limits';

update public.service_expectation_blocks set body = 'Social media rarely brings in bookings directly, so it''s best judged on reach and engagement rather than new clients. Its job is to make your practice familiar, so you''re the name people think of when they need a vet. The posts that do best show your real team and patients, and we''ll need your help with photos to make those.', updated_at = now() where block_key = 'smm_limits';

update public.service_expectation_blocks set body = 'A new article takes weeks to show up in Google and months to bring in steady traffic. The value builds as the library grows. Your service pages still matter more for bookings, and anything medical comes to you for review before it''s published.', updated_at = now() where block_key = 'blog_limits';

update public.service_expectation_blocks set body = 'Google only removes reviews that break its rules, so we can''t take down a negative review just because it''s unfair. Reviews also carry the most weight when your team asks for them in person. What we can do is make asking easy, reply well to every review, and keep new reviews coming in steadily.', updated_at = now() where block_key = 'orm_limits';
