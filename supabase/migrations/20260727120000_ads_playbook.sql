-- The "I have this issue" playbook — codified ads fixes, folded into the
-- existing best_practices store (category 'Ads Playbook'). Keys mirror the
-- Ads Diagnostic issue keys so findings can link to their entry later. Content
-- is dollar-quoted so apostrophes/newlines need no escaping. Admin-editable.
insert into public.best_practices (key, label, category, content, sort_order) values
  ('ads.expected_ctr_low', 'Expected CTR is below average', 'Ads Playbook', $md$SYMPTOM
The keyword shows "Below average" for Expected CTR. Google predicts your ad is less likely to be clicked than competitors for this search — judged on the ad itself, position-normalized.

WHY IT MATTERS
One of the three Ad Rank inputs. A weak one costs position and raises CPC, and you cannot bid your way out of it.

HOW TO FIX
1. Tighten the ad group so a few same-theme keywords share one ad — loose ad groups cannot have relevant ads.
2. Rewrite the ad: keyword/intent in a headline, a reason to click (same-day, new clients welcome, 24/7 emergency, financing), a specific CTA (Call Today, Book Online).
3. Add every relevant asset — call, location, sitelinks, callouts, promotions, images. A bigger ad earns more clicks, which feeds the signal.
4. Fill all ~15 headlines and 4 descriptions; do not over-pin.
5. Tighten match types and add negatives so the ad only shows on high-intent searches.

WATCH
Expected CTR component, actual CTR by ad, abs-top IS. Allow 1–2 weeks of impressions.$md$, 110),
  ('ads.ad_relevance_low', 'Ad relevance is below average', 'Ads Playbook', $md$SYMPTOM
The keyword shows "Below average" for Ad relevance — the ad text does not closely match what the person searched.

WHY IT MATTERS
One of the three Ad Rank inputs. Low relevance means more cost for less position, and a generic-feeling ad.

HOW TO FIX
1. Split the culprit keywords into a tighter, single-theme ad group.
2. Put the keyword theme directly in the RSA headlines and description. If the search is "cat dental cleaning", the ad should say it.
3. Point the ad at the matching service page, not a generic one.
4. Move keywords that do not fit the theme to where they belong.

WATCH
Ad relevance component. The Ads Diagnostic "Draft ad copy" button writes headlines that echo the culprit keywords.$md$, 120),
  ('ads.landing_page_low', 'Landing page experience is below average', 'Ads Playbook', $md$SYMPTOM
The keyword shows "Below average" for Landing page experience — the page people reach is slow, thin, or off-topic.

WHY IT MATTERS
An Ad Rank input AND the one most likely to also hurt conversion rate. Fixing the page helps position and leads.

HOW TO FIX
1. Send the ad to the most relevant service page, not the homepage — match the ad promise, service, and city.
2. Make the next step obvious: phone number and Book/Call CTA above the fold on mobile.
3. Fix mobile speed — check the client site audit; compress the hero image, defer non-critical scripts.
4. Add the trust signals a pet owner looks for: hours, location/map, services, reviews.

WATCH
Landing page component; the page's site audit / Lighthouse score.$md$, 130),
  ('ads.lost_is_budget', 'Losing impression share to budget', 'Ads Playbook', $md$SYMPTOM
Search Lost IS (budget) is high — the campaign is eligible to show more but the daily budget runs out. If it also converts, you are turning off a profitable tap.

WHY IT MATTERS
Usually the cleanest growth lever: these searches already convert; you just are not showing for all of them.

HOW TO FIX
1. If CPA is acceptable, raise the daily budget — start with a lift roughly matching the lost-to-budget %, capped so you can watch CPA.
2. If you cannot add budget, concentrate it: tighten geo radius, cut low-value dayparts, pause weak keywords.
3. Recheck Lost IS (budget) after a week — it should fall toward zero.

WATCH
Search Lost IS (budget), impression share, CPA. If losing to rank too, fix rank first — better Quality Score lowers CPCs and stretches the budget.$md$, 140),
  ('ads.lost_is_rank', 'Losing impression share to Ad Rank', 'Ads Playbook', $md$SYMPTOM
Search Lost IS (rank) is high and abs-top IS is low — you are eligible but Ad Rank is not strong enough to hold position. Raising budget will NOT fix this.

WHY IT MATTERS
You show low or not at all on searches you are eligible for, and pay more per click than you should.

HOW TO FIX
1. Find the weak Ad Rank input from the keywords' Quality Score components (see the expected-CTR, ad-relevance, landing-page entries).
2. If Quality Score is fine, it is a bid problem: raise the target (tCPA/tROAS) or lift max CPC ~15–20%.
3. Fix the weak component per its playbook entry.
4. Recheck abs-top IS after a week.

WATCH
Search Lost IS (rank), abs-top IS, Quality Score components. The Ads Diagnostic pinpoints the weak input automatically.$md$, 150),
  ('ads.low_abs_top_is', 'Low top-of-page presence (abs-top IS)', 'Ads Playbook', $md$SYMPTOM
Absolute top IS is low — your ad rarely appears in the very first slot, even when it shows. For local click-to-call, that top slot is where most calls happen.

WHY IT MATTERS
Position 1 takes a disproportionate share of clicks and calls. Low abs-top IS caps call volume no matter how good the ad is.

HOW TO FIX
1. Diagnose the cause — lost to budget or to rank? The fix depends on it.
2. If rank: improve the weakest Quality Score input and/or raise bids.
3. If budget: raise or concentrate budget so you can afford the top slot more often.
4. Consider a Target Impression Share strategy set to "absolute top" for the flagship campaign, with a max CPC cap.

WATCH
Search abs-top IS, Lost IS (budget), Lost IS (rank).$md$, 160),
  ('ads.high_cpa', 'A campaign converts far above the account CPA', 'Ads Playbook', $md$SYMPTOM
One campaign costs much more per conversion than the account average — dragging overall efficiency.

WHY IT MATTERS
Budget at a bad CPA is budget not spent where it works. Usually a symptom of loose targeting or a weak landing page.

HOW TO FIX
1. Check its search terms for waste and add negatives.
2. Check the landing page — is it the right, conversion-focused page for the service?
3. Tighten match types; pause keywords with spend and no conversions.
4. If it is a genuinely lower-intent service, cap its budget and shift toward efficient campaigns.

WATCH
Cost / conversion vs account CPA, search terms, conversion rate.$md$, 170),
  ('ads.wasted_spend', 'Spend on search terms that do not convert', 'Ads Playbook', $md$SYMPTOM
Search terms with real spend and zero conversions — money going to the wrong searches (jobs, free, DIY, wrong services).

WHY IT MATTERS
Every dollar on a non-converting term is a dollar not spent on one that works. Negatives redirect it immediately.

HOW TO FIX
1. Review the search terms report for spend + zero conversions over a meaningful window.
2. Add clearly-irrelevant ones as negatives (exact for specific terms, phrase for patterns).
3. Fold recurring offenders into the universal PPC negatives list in Best Practices.
4. Watch for terms that convert on a longer window before cutting them.

WATCH
Search terms cost and conversions. The Ads Diagnostic drafts a negatives list from zero-conversion terms.$md$, 180),
  ('ads.conversion_tracking', 'Conversion tracking is unreliable', 'Ads Playbook', $md$SYMPTOM
No enabled conversion actions, or spend with zero conversions recorded, or no phone-call conversion for a practice that runs on calls.

WHY IT MATTERS
The foundation. If leads are not tracked correctly, every other metric lies and Smart Bidding optimizes toward nothing. Fix this first.

HOW TO FIX
1. Verify the conversion tag actually fires (Tag Assistant / a test lead).
2. Set calls-from-ads as a conversion with a 60-second minimum so real calls count.
3. Mark the true lead action (call, form, booking) as Primary; demote soft actions (page views) to Secondary.
4. Confirm the counting type fits (one per click for leads).

WATCH
conversion_action status/category/counting, conversions vs spend.$md$, 190)
on conflict (key) do nothing;
