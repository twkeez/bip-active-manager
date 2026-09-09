-- Plain-language definitions for the client expectations document.
--
-- One shared list rather than a block of text per service: the document covers
-- every service a client bought, and the vocabulary overlaps. "Impressions"
-- means the same thing in search and in ads, and per-service text would print
-- it twice and let the two copies drift.
--
-- services = {} means general, and always appears.

create table if not exists public.expectation_glossary (
  id bigint generated always as identity primary key,
  term text not null,
  definition text not null,
  services text[] not null default '{}',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_expectation_glossary_term
  on public.expectation_glossary (lower(term));

alter table public.expectation_glossary enable row level security;

grant select on public.expectation_glossary to authenticated;

drop policy if exists "expectation_glossary_select_authenticated" on public.expectation_glossary;
create policy "expectation_glossary_select_authenticated"
  on public.expectation_glossary
  for select
  to authenticated
  using (true);

-- Starting drafts, in the order they make sense to a practice owner reading
-- top to bottom: what the results are, then how we influence them, then how we
-- measure. All editable in the app.
insert into public.expectation_glossary (term, definition, services, sort_order)
values
  ('Organic results',
   'The unpaid listings in Google''s search results. They are earned through the quality and relevance of your site rather than bought, which is why they take time to move and why they keep working once they do.',
   '{seo}', 10),
  ('Paid results',
   'The ads at the top and bottom of a search page, marked "Sponsored". They appear as soon as a campaign is running and stop the moment the budget does — the opposite of organic results in both respects.',
   '{seo,ppc}', 20),
  ('Keyword',
   'A word or phrase someone types into Google. For a practice these are usually a service plus a place — "emergency vet Boulder" — rather than single words.',
   '{seo,ppc}', 30),
  ('Google Business Profile',
   'Your free listing on Google Search and Maps: hours, phone number, photos, and reviews. For a local practice it is often more valuable than the website itself, and it is the first thing we work on.',
   '{seo,orm}', 40),
  ('Map Pack',
   'The block of three local businesses shown on a map above the regular results. Most "vet near me" searches are won or lost here, and getting into it is usually the single biggest source of new calls.',
   '{seo}', 50),
  ('Local SEO',
   'The work aimed specifically at showing up for people searching near you — your Google Business Profile, reviews, and consistent business details — as distinct from ranking nationally.',
   '{seo}', 60),
  ('On-page SEO',
   'Changes to the content of your pages: headings, wording, page titles, and internal links, so both people and Google can tell what each page is for.',
   '{seo}', 70),
  ('Technical SEO',
   'The plumbing — site speed, mobile layout, broken links, and whether Google can read your pages at all. Usually invisible to visitors, and the first thing we fix because everything else depends on it.',
   '{seo}', 80),
  ('Structured data',
   'Hidden code that tells Google what your pages describe — that you are a veterinary practice, these are your hours, this is a service. It helps Google display your details correctly.',
   '{seo}', 90),
  ('NAP consistency',
   'Name, Address, Phone. Google cross-checks these across the web, and mismatched or outdated listings undermine your local ranking, so they need to agree everywhere.',
   '{seo,orm}', 100),
  ('Citation',
   'A mention of your practice name, address, and phone on another site — directories, veterinary associations, chambers of commerce. They act as corroboration that you are where you say you are.',
   '{seo}', 110),
  ('Backlink',
   'A link to your site from another website. Google reads them as votes of confidence; a few from respected local or veterinary sources are worth far more than many from low-quality ones.',
   '{seo}', 120),
  ('Indexing',
   'Google finding a page and adding it to its list of results. A page that is not indexed cannot rank for anything, so this is the first milestone on any new or fixed page.',
   '{seo}', 130),
  ('Search Console',
   'A free Google tool showing how your site performs in search — which searches you appear for, and what people click. It is where the numbers in your reports come from.',
   '{seo}', 140),
  ('Core Web Vitals',
   'Google''s measurements of how quickly and smoothly a page loads for a real visitor. Poor scores hold rankings back and, more importantly, lose people before the page finishes loading.',
   '{seo}', 150),
  ('Impressions',
   'How many times your listing was shown to someone. Impressions rising before clicks do is the normal early sign that visibility is improving.',
   '{}', 160),
  ('Clicks',
   'How many times someone actually chose your listing and visited. Fewer than impressions, always — the gap between them tells us how compelling your listing looks.',
   '{}', 170),
  ('Conversion',
   'A visit that turned into something worth having: a phone call, a booking, a form submission. The number that matters most, and the reason we set up call tracking early.',
   '{}', 180)
on conflict (lower(term)) do nothing;

-- A starting draft for the new "What this isn't" field on SEO. The expectations
-- this document sets are as much about what will not happen as what will, and
-- saying so at kickoff is what prevents the month-two phone call.
insert into public.service_expectation_blocks (block_key, body, sort_order)
values (
  'seo_limits',
  'SEO is not advertising — we cannot buy a position, and nobody can guarantee a ranking. Any agency that guarantees one is guessing. It is also not instant: the first couple of months are foundation work whose payoff shows up later, and progress appears in impressions before it appears in calls. And it is not entirely within our control — your competitors, Google''s own changes, and your reviews, hours and accuracy all move results. We will always be straight with you about which of those is in play.',
  0
)
on conflict (block_key) do nothing;
