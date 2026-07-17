-- SEO half of the "I have this issue" playbook, folded into best_practices
-- (category 'SEO Playbook'). Keys are namespaced seo.* so a future SEO
-- diagnostic can link findings to their entry, exactly like the ads playbook.
insert into public.best_practices (key, label, category, content, sort_order) values
  ('seo.striking_distance', 'A keyword is stuck on page 2 (positions 8–20)', 'SEO Playbook', $md$SYMPTOM
A tracked keyword/page ranks roughly positions 8–20 — on the doorstep of page 1 but getting almost no clicks.

WHY IT MATTERS
Page 1 takes the vast majority of clicks; a page at #12 is one push from real traffic. Cheapest, fastest organic win — you already rank, you just need a nudge.

HOW TO FIX
1. Make the page the clear best answer — add a focused section that directly serves the search intent (the service, the city, common questions).
2. Add internal links to it from relevant higher-authority pages, using the target phrase as anchor.
3. Tighten the title tag and H1 to include the keyword and city.
4. Expand/refresh the content; add FAQs and related sub-topics it is thin on.
5. Earn a couple of relevant local links/citations if the query is competitive.

WATCH
Position over 4–8 weeks; movement into the top 5 and the click lift in GSC.$md$, 210),
  ('seo.ranking_drop', 'Rankings dropped for a page or keyword', 'SEO Playbook', $md$SYMPTOM
A page that ranked well fell noticeably over days/weeks.

WHY IT MATTERS
Drops bleed traffic fast and usually have a fixable cause. Catching it early prevents a slide.

HOW TO FIX
1. Confirm it is real and sustained (not a one-day SERP wobble) on the rank tracker.
2. Check self-inflicted causes: a recent site change, title/content edit, redirect, accidental noindex, or a broken page.
3. Check indexation via GSC URL Inspection — is the page still indexed?
4. Look for a Google update around the drop date; if algorithmic, focus on content quality and helpfulness.
5. Check whether a competitor overtook you — compare their page and close the gap.

WATCH
Position recovery; GSC impressions/clicks for the affected page.$md$, 220),
  ('seo.cannibalization', 'Two pages compete for the same keyword', 'SEO Playbook', $md$SYMPTOM
Multiple URLs try to rank for the same query and positions flip-flop between them in GSC — neither ranks as well as one strong page would.

WHY IT MATTERS
Splitting relevance across pages weakens all of them. Consolidating focuses authority.

HOW TO FIX
1. Identify the query where two URLs alternate in GSC.
2. Pick the primary page (best content, authority, intent match).
3. Fold the other page's unique value into the primary, then 301-redirect it — or clearly differentiate their intents.
4. Point internal links at the primary page with the target anchor.

WATCH
The primary URL stabilizing and climbing for the query.$md$, 230),
  ('seo.gbp_incomplete', 'Google Business Profile is incomplete or unverified', 'SEO Playbook', $md$SYMPTOM
The GBP is unverified or missing categories, hours, services, or photos. Often the single biggest local SEO gap.

WHY IT MATTERS
For a vet, the map pack drives huge "near me" and emergency traffic. An incomplete/unverified profile caps local visibility and calls no matter how good the website is.

HOW TO FIX
1. Verify the profile and claim ownership.
2. Set the primary category precisely (Veterinarian / Animal hospital / Emergency veterinarian service) plus relevant secondaries.
3. Fill everything: hours (incl. holiday/emergency), phone, website, services, complete description.
4. Add real photos regularly; enable and respond to reviews and Q&A.
5. Keep NAP identical to the website and major citations.

WATCH
Local-grid rank, GBP calls/direction requests, review velocity.$md$, 240),
  ('seo.local_pack_absent', 'Not showing in the local map pack', 'SEO Playbook', $md$SYMPTOM
The practice does not appear in the 3-pack for its core "vet near me" / service + city searches, per the local-grid rank.

WHY IT MATTERS
The map pack sits above organic for local intent — absence here loses the highest-intent local traffic.

HOW TO FIX
1. Fix GBP fundamentals first (see the GBP entry): categories, verification, completeness.
2. Build proximity relevance: service + area content on the site, embedded map, location pages if multi-site.
3. Grow reviews steadily (Gather Up) — volume, recency, and rating all feed local rank.
4. Build/clean local citations with consistent NAP (directories, vet associations).
5. Read the grid — ranking near the clinic but dropping off with distance is a relevance/authority signal to strengthen.

WATCH
Local-grid coverage and average map rank across the grid.$md$, 250),
  ('seo.nap_inconsistent', 'Inconsistent business name / address / phone (NAP)', 'SEO Playbook', $md$SYMPTOM
The name, address, or phone differs across the website, GBP, and directory listings.

WHY IT MATTERS
Inconsistent NAP confuses Google about which data to trust and weakens local ranking and map-pack presence.

HOW TO FIX
1. Define the canonical NAP (exactly as on GBP and the site).
2. Audit major citations (directories, vet associations, review sites) and correct mismatches.
3. Fix the website: consistent NAP in the footer and contact page, with LocalBusiness schema.
4. Suppress or merge duplicate GBP listings.

WATCH
Citation consistency; local-grid rank over time.$md$, 260),
  ('seo.low_ctr', 'High impressions, low click-through (title/meta)', 'SEO Playbook', $md$SYMPTOM
A page/query gets lots of GSC impressions but a click-through rate below what its position should earn — you rank but people scroll past.

WHY IT MATTERS
A title/meta rewrite is the cheapest win in SEO. You already earned the ranking; you are just not earning the click.

HOW TO FIX
1. Rewrite the title tag: lead with service + city, add a differentiator (same-day, 24/7, new clients welcome), keep under ~60 chars.
2. Write a compelling meta description with a clear benefit and CTA.
3. Add structured data where relevant (LocalBusiness, FAQ, review) to earn rich results.
4. Match the title to real search intent — do not keyword-stuff.

WATCH
CTR for the page/query in GSC over 2–4 weeks at the same position.$md$, 270),
  ('seo.not_indexed', 'Important pages are not indexed', 'SEO Playbook', $md$SYMPTOM
Key pages are missing from Google — GSC shows Excluded/Not indexed, or a site: search does not return them.

WHY IT MATTERS
An unindexed page cannot rank at all. A hard ceiling, not a lever.

HOW TO FIX
1. Inspect the URL in GSC and read the reason (crawled-not-indexed, discovered-not-indexed, noindex, canonicalized away).
2. Remove accidental noindex/robots blocks; fix canonicals pointing elsewhere.
3. Ensure the page is in the sitemap and internally linked (orphan pages struggle to get indexed).
4. Improve the page's value if Google judged it thin/duplicate, then request indexing.

WATCH
GSC Pages/Coverage report; the page appearing for a site: search.$md$, 280),
  ('seo.slow_pages', 'Slow pages / poor Core Web Vitals', 'SEO Playbook', $md$SYMPTOM
Site audit / Lighthouse flags slow load or poor LCP/CLS, especially on mobile.

WHY IT MATTERS
Speed is both a ranking factor and a conversion factor — slow pages lose rankings and the visitors who do arrive.

HOW TO FIX
1. Compress and correctly size images (hero images are the usual culprit).
2. Defer non-critical scripts; remove unused plugins/tags.
3. Fix layout shift — reserve space for images/embeds.
4. Prioritize the templates that matter most: home, service pages, location pages.

WATCH
Lighthouse / Core Web Vitals scores for the key templates; the site audit trend.$md$, 290),
  ('seo.content_gap', 'Missing service/condition pages competitors rank for', 'SEO Playbook', $md$SYMPTOM
Competitors rank for services or conditions the practice offers but has no dedicated page for (per the DataForSEO content-gap / keyword ideas).

WHY IT MATTERS
You cannot rank for a service you have no page for. Each gap is captured traffic going to a competitor.

HOW TO FIX
1. Pull the keywords competitors rank for that you do not.
2. Prioritize by search volume and by services the practice actually offers.
3. Build a genuinely useful page per priority service/condition — intent-matched, local, with a clear next step.
4. Internally link it from related pages and the services hub.

WATCH
New pages entering the index and climbing; impressions for the new topic in GSC.$md$, 300),
  ('seo.thin_content', 'Thin or low-value content', 'SEO Playbook', $md$SYMPTOM
Pages with little unique content, or blog posts that do not target real search demand.

WHY IT MATTERS
Thin pages rarely rank and can drag site-wide quality signals. Helpful, substantive content is what earns and holds rankings.

HOW TO FIX
1. Identify thin pages (low word count, no rankings, high bounce) and decide: improve, consolidate, or remove.
2. Expand the keepers to fully answer the query — sections, FAQs, images, internal links.
3. Consolidate overlapping thin pages into one strong page (301 the rest).
4. For the blog, target topics with real local/pet-owner search demand, not filler.

WATCH
Rankings and engagement for improved pages; overall indexed-quality.$md$, 310)
on conflict (key) do nothing;
