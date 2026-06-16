-- Playbook seed: best practices for all service tiers
-- Categories: Initial Setup, Monthly Work, Monthly Communications, Guidelines

insert into public.playbook_items (tier_key, category, type, title, body, auto_verify_key, sort_order) values

-- ─────────────────────────────────────────────
-- SEO FOUNDATION
-- ─────────────────────────────────────────────
('seo-foundation','Initial Setup','checklist','Connect Google Search Console','Add and verify the client site in GSC. Confirm ownership and check for crawl errors before anything else.','gsc_connected',10),
('seo-foundation','Initial Setup','checklist','Connect Google Analytics 4','Set up GA4 property, confirm data is flowing, and link to GSC.','ga4_connected',20),
('seo-foundation','Initial Setup','checklist','Set up Google Tag Manager','Install GTM container on the site. All tracking should fire through GTM — not hardcoded.', null,30),
('seo-foundation','Initial Setup','checklist','Claim and optimize Google Business Profile','Claim/verify GBP. Complete all fields: categories, services, hours, photos, description, NAP. This is the highest-ROI action at Foundation level.','gbp_connected',40),
('seo-foundation','Initial Setup','checklist','Run site audit','Complete technical SEO audit. Document crawl errors, missing meta tags, broken links, duplicate content, and indexing issues.', null,50),
('seo-foundation','Initial Setup','checklist','Submit XML sitemap to GSC','Verify sitemap is valid, error-free, and submitted in GSC.', null,60),
('seo-foundation','Initial Setup','checklist','Optimize title tags and meta descriptions','Review and update all core pages with geo-targeted keywords. Each page title should be unique and under 60 characters.', null,70),
('seo-foundation','Initial Setup','checklist','Link Basecamp project','Create and link the client Basecamp project for ongoing communications.','basecamp_linked',80),

('seo-foundation','Monthly Work','checklist','Keyword and meta tag maintenance','Review core page metadata monthly. Update any pages that dropped rankings or changed in scope.', null,10),
('seo-foundation','Monthly Work','checklist','Monitor sitemap health in GSC','Check for newly discovered errors, excluded pages, or indexing drops.', null,20),
('seo-foundation','Monthly Work','checklist','Review GBP for accuracy','Confirm hours, services, photos, and contact info are current. Add a monthly update if anything changed.', null,30),

('seo-foundation','Monthly Communications','deliverable','Monthly Marketing Update — Data','Send data-focused communication: GSC highlights (clicks, impressions, top queries), GBP views and actions. Keep it visual and tied to outcomes.', null,10),
('seo-foundation','Monthly Communications','deliverable','Monthly Marketing Update — Comms','Second touchpoint: lighter check-in. Acknowledge work completed, flag any issues, share a seasonal tip or industry note. No heavy data required.', null,20),

('seo-foundation','Guidelines','guideline','Prioritize NAP consistency first','Name, Address, and Phone must be identical across Google, Yelp, Apple Maps, and Bing before pursuing rankings. Inconsistent NAP actively harms local SEO.', null,10),
('seo-foundation','Guidelines','guideline','Foundation scope boundary','Focus on setup, compliance, and baseline visibility. Content strategy, blogging, and keyword campaigns are Premium conversations — do not scope creep into those at this tier.', null,20),
('seo-foundation','Guidelines','guideline','Set expectations around timelines','New SEO clients should expect 90–120 days before meaningful ranking movement. Set this expectation at onboarding to prevent churn from unrealistic expectations.', null,30),

-- ─────────────────────────────────────────────
-- SEO PREMIUM
-- ─────────────────────────────────────────────
('seo-premium','Initial Setup','checklist','Complete all SEO Foundation setup items','All Foundation requirements must be in place before Premium work begins.', null,5),
('seo-premium','Initial Setup','checklist','Build custom reporting dashboard','Create reporting view with keyword rankings, GSC traffic, GBP insights, and competitor data.', null,10),
('seo-premium','Initial Setup','checklist','Configure keyword tracking','Set up position tracking for 20–40 priority keywords. Include brand, service, and location variants.', null,20),
('seo-premium','Initial Setup','checklist','Set up competitor tracking','Identify 3–5 local competitors. Track their keyword rankings and GBP review velocity monthly.', null,30),

('seo-premium','Monthly Work','checklist','Monthly keyword review','Check ranking movement for tracked terms. Identify movers, decliners, and new opportunities from GSC.', null,10),
('seo-premium','Monthly Work','checklist','Monthly on-page optimization','Update or optimize at least one key page per month based on GSC click/impression data and ranking gaps.', null,20),
('seo-premium','Monthly Work','checklist','Competitor position check','Review competitor ranking changes. Flag any competitor who has surpassed the client in a priority term.', null,30),
('seo-premium','Monthly Work','checklist','Publish monthly GBP post','Post one Google Business Profile update monthly — promotion, pet health tip, or practice news.', null,40),

('seo-premium','Monthly Communications','deliverable','Monthly Marketing Update — Data','Full report: keyword rankings, GSC traffic trend, GBP insights, top pages, competitor snapshot. Tie data to business outcomes where possible.', null,10),
('seo-premium','Monthly Communications','deliverable','Monthly Marketing Update — Comms','Second touchpoint: upcoming content topics, optimization wins, or what to expect next month.', null,20),

('seo-premium','Guidelines','guideline','Target local high-intent keywords','Focus on terms within the client''s immediate service area (10–15 mile radius for wellness care). "Vet near me" and "veterinarian [City]" convert better than broad informational terms.', null,10),
('seo-premium','Guidelines','guideline','Report on what clients actually care about','Lead with new patient-driving keywords, local map pack visibility, and GBP call clicks — not just impressions. Clients want to know if SEO is bringing them patients, not just traffic.', null,20),
('seo-premium','Guidelines','guideline','Optimization cadence','Make meaningful changes monthly. Even small updates signal freshness to Google. Document every change so you can attribute ranking shifts.', null,30),

-- ─────────────────────────────────────────────
-- SEO PREMIUM PLUS
-- ─────────────────────────────────────────────
('seo-premium-plus','Initial Setup','checklist','Complete all SEO Premium setup items','All Premium requirements must be in place before Premium Plus work begins.', null,5),
('seo-premium-plus','Initial Setup','checklist','Deploy llms.txt to client site','Generate and publish llms.txt and llms-full.txt to the root of the client''s site. This ensures AI search engines (ChatGPT, Perplexity, Claude) can accurately index and cite the practice.', null,10),
('seo-premium-plus','Initial Setup','checklist','Identify specialty service landing page opportunities','Audit which high-margin services (surgery, dentistry, exotics, emergency) have weak or missing dedicated pages. Map out a build priority list.', null,20),
('seo-premium-plus','Initial Setup','checklist','Configure regional keyword tracking','Expand keyword tracking to include specialty and regional terms beyond the local area.', null,30),

('seo-premium-plus','Monthly Work','checklist','Write and publish monthly SEO blog','One custom-written, locally-relevant blog post per month. Topic should target a seasonal or high-intent veterinary query. SEO optimize, edit, and post.', null,10),
('seo-premium-plus','Monthly Work','checklist','Review specialty landing page performance','Monthly review of traffic, rankings, and conversion rates for specialty service pages. Update content at least quarterly.', null,20),
('seo-premium-plus','Monthly Work','checklist','Regional keyword expansion check','Monitor emerging regional search opportunities and add new terms to the tracking set quarterly.', null,30),
('seo-premium-plus','Monthly Work','checklist','Publish monthly GBP post','Post one Google Business Profile update monthly — can mirror or summarize the monthly blog.', null,40),

('seo-premium-plus','Monthly Communications','deliverable','Monthly Marketing Update — Data','Comprehensive report: local + regional rankings, content performance, GSC data, GBP insights, specialty page traffic, AI search visibility notes.', null,10),
('seo-premium-plus','Monthly Communications','deliverable','Monthly content calendar preview','Share upcoming blog topic and any specialty content planned for the month ahead. Get client buy-in early.', null,20),
('seo-premium-plus','Monthly Communications','deliverable','Monthly Marketing Update — Comms','Second touchpoint: blog recap, AI search positioning update, or strategic recommendation for next quarter.', null,30),

('seo-premium-plus','Guidelines','guideline','Dual-radius strategy','Track local (10–15mi wellness) and regional (up to 50mi specialty) keyword performance separately. Report on each in the monthly update.', null,10),
('seo-premium-plus','Guidelines','guideline','Blog quality over AI filler','One well-researched, locally-relevant blog post outperforms five generic AI-generated posts. Write for the practice''s actual patient base and local search context.', null,20),
('seo-premium-plus','Guidelines','guideline','AEO is a Premium Plus differentiator','AI search optimization (AEO) is where Premium Plus clients get an edge. Position this to clients as future-proofing their visibility against competitors who haven''t adapted.', null,30),

-- ─────────────────────────────────────────────
-- ADS PREMIUM (ppc-premium)
-- ─────────────────────────────────────────────
('ppc-premium','Initial Setup','checklist','Link Google Ads to BIP agency MCC','Connect client account to the BIP MCC. Confirm access before any campaign work begins.','ads_synced',10),
('ppc-premium','Initial Setup','checklist','Install Google Tag Manager','Ensure GTM is on the site and the container is configured correctly.', null,20),
('ppc-premium','Initial Setup','checklist','Configure conversion tracking','Set up call tracking, form submission, and appointment request conversions. Every meaningful client action must be tracked.', null,30),
('ppc-premium','Initial Setup','checklist','Build reporting dashboard','Create a performance dashboard showing spend, clicks, impressions, conversions, and cost-per-acquisition.', null,40),
('ppc-premium','Initial Setup','checklist','Document budget recommendation','Provide written budget recommendation with rationale before launching. Get client sign-off.', null,50),
('ppc-premium','Initial Setup','checklist','Launch Google Search campaign','Build and launch the primary local search campaign targeting high-intent vet terms ("vet near me," "veterinarian [City]," "emergency vet [City]").', null,60),
('ppc-premium','Initial Setup','checklist','Implement negative keyword list','Add job seekers, competitors, irrelevant searches, and low-intent terms before launch. This prevents wasted spend from day one.', null,70),
('ppc-premium','Initial Setup','checklist','Link Basecamp project','Connect client Basecamp project for communications.','basecamp_linked',80),

('ppc-premium','Monthly Work','checklist','Performance review and bid adjustments','Review CTR, conversion rate, CPA, and search term reports. Adjust bids based on what is and isn''t working.', null,10),
('ppc-premium','Monthly Work','checklist','Refresh negative keyword list','Add newly discovered irrelevant search terms to the negative list.', null,20),
('ppc-premium','Monthly Work','checklist','Ad copy performance review','Identify underperforming ads. Test at least one new variant per quarter.', null,30),
('ppc-premium','Monthly Work','checklist','Budget pacing check','Confirm spend is pacing correctly relative to monthly budget. Adjust daily budgets if underspending or at risk of overspending.', null,40),

('ppc-premium','Monthly Communications','deliverable','Monthly Marketing Update — Data','Ads performance report: spend, impressions, clicks, CTR, conversions, CPA. Compare to prior month and goal benchmarks.', null,10),
('ppc-premium','Monthly Communications','deliverable','Monthly Marketing Update — Comms','Second touchpoint: campaign highlights, upcoming adjustments, or seasonal budget recommendations.', null,20),

('ppc-premium','Guidelines','guideline','Local intent targeting only','Focus on high-intent, near-me and city-specific terms. Avoid broad match keywords that attract out-of-area or low-intent traffic. Quality over volume.', null,10),
('ppc-premium','Guidelines','guideline','Landing page alignment','Ads should direct to targeted, fast-loading landing pages — never the homepage. Page must match the ad''s promise.', null,20),
('ppc-premium','Guidelines','guideline','Negative keywords prevent wasted spend','A strong negative keyword list is as important as the targeting itself. Review search term reports every month.', null,30),

-- ─────────────────────────────────────────────
-- ADS PREMIUM PLUS (ppc-premium-plus)
-- ─────────────────────────────────────────────
('ppc-premium-plus','Initial Setup','checklist','Complete all Ads Premium setup items','All Premium requirements must be in place before Premium Plus work begins.', null,5),
('ppc-premium-plus','Initial Setup','checklist','Launch additional Google or Meta campaign','Set up the second campaign — local services, display, or Meta depending on strategy and budget.', null,10),
('ppc-premium-plus','Initial Setup','checklist','Configure dual-radius campaign structure','Separate campaigns for local wellness targeting and regional specialty targeting with distinct budgets and keywords.', null,20),
('ppc-premium-plus','Initial Setup','checklist','Set up call tracking analytics','Implement dynamic number insertion for granular call attribution by campaign and keyword.', null,30),
('ppc-premium-plus','Initial Setup','checklist','Configure A/B ad copy testing framework','Set up ad variation testing within campaigns. Minimum two variants per ad group.', null,40),

('ppc-premium-plus','Monthly Work','checklist','Review all active campaigns (up to 4)','Monthly performance review across every running campaign. No campaign should go unreviewed for more than 30 days.', null,10),
('ppc-premium-plus','Monthly Work','checklist','A/B test analysis and iteration','Review which ad variants are winning. Pause underperformers and introduce new challengers.', null,20),
('ppc-premium-plus','Monthly Work','checklist','Cross-channel budget allocation review','Assess whether the Google/Meta budget split is optimized. Shift spend to the channel producing the lower CPA.', null,30),
('ppc-premium-plus','Monthly Work','checklist','Call tracking report review','Review call volume, call duration, and missed calls. Flag patterns for the client.', null,40),

('ppc-premium-plus','Monthly Communications','deliverable','Monthly Marketing Update — Data','Full cross-channel report: Google Ads + Meta performance, call tracking data, A/B results, CPA by campaign, regional vs local breakdown.', null,10),
('ppc-premium-plus','Monthly Communications','deliverable','Monthly Marketing Update — Comms','Second touchpoint: campaign wins, upcoming test ideas, or seasonal strategy adjustments.', null,20),

('ppc-premium-plus','Guidelines','guideline','Up to 4 concurrent campaigns','Prioritize campaigns by patient acquisition value and margin. High-ticket specialty campaigns (surgery, dentistry, emergency) often justify higher CPAs.', null,10),
('ppc-premium-plus','Guidelines','guideline','Meta ads complement search intent','Meta is awareness, not conversion. Use it for specialty promotions and brand building — not as a replacement for search campaigns.', null,20),

-- ─────────────────────────────────────────────
-- SOCIAL MEDIA STANDARD (social-standard)
-- ─────────────────────────────────────────────
('social-standard','Initial Setup','checklist','Set up and optimize Google Business Profile','Complete GBP with photos, hours, services, and accurate NAP.','gbp_connected',10),
('social-standard','Initial Setup','checklist','Set up and optimize Facebook Page','Ensure page is complete with branding, contact info, about section, and a pinned post.', null,20),
('social-standard','Initial Setup','checklist','Set up and optimize Instagram Account','Complete profile with branded bio, profile photo, and highlight covers.', null,30),
('social-standard','Initial Setup','checklist','Apply consistent social branding','Profile photos, cover images, and visual identity must be consistent across all platforms. Use the brand guide.', null,40),
('social-standard','Initial Setup','checklist','Set up reporting dashboard','Configure social reporting to track reach, engagement, and follower growth monthly.', null,50),
('social-standard','Initial Setup','checklist','Link Basecamp project','Connect client Basecamp project for communications.','basecamp_linked',60),

('social-standard','Monthly Work','checklist','Create 5 posts for client to share','Deliver 5 ready-to-use posts (graphics + copy) monthly. Client is responsible for publishing to their own channels.', null,10),
('social-standard','Monthly Work','checklist','Monitor engagement','Check for comments, messages, and mentions. Alert client to anything requiring their response within 24 hours.', null,20),

('social-standard','Monthly Communications','deliverable','Monthly Marketing Update — Data','Social performance summary: reach, engagement rate, follower growth, top-performing post.', null,10),
('social-standard','Monthly Communications','deliverable','Monthly Marketing Update — Comms','Second touchpoint: upcoming content themes, seasonal pet health reminders, or a platform tip.', null,20),

('social-standard','Guidelines','guideline','Client posts the content — set this expectation clearly','At Standard level, BIP creates the content but the client publishes it. Clarify this at onboarding to avoid confusion or blame if posting falls behind.', null,10),
('social-standard','Guidelines','guideline','Engagement monitoring is a promise','We monitor — we do not manage. If a client expects us to respond to comments, that is Premium scope. Document what is and is not included.', null,20),
('social-standard','Guidelines','guideline','Upsell opportunity at Standard','Standard clients who are active on social and seeing engagement are good upsell candidates for Premium. Track who is publishing and engaging.', null,30),

-- ─────────────────────────────────────────────
-- SOCIAL MEDIA PREMIUM (social-premium)
-- ─────────────────────────────────────────────
('social-premium','Initial Setup','checklist','Complete all Social Standard setup items','All Standard setup requirements must be in place first.', null,5),
('social-premium','Initial Setup','checklist','Add 1 additional social platform','Set up and optimize one additional platform (Nextdoor, LinkedIn, or Twitter/X) based on the practice''s audience.', null,10),
('social-premium','Initial Setup','checklist','Configure content approval workflow','Establish how the client will review and approve content before it posts. Agree on turnaround time.', null,20),

('social-premium','Monthly Work','checklist','Create and schedule up to 10 posts/month','Build and schedule a full monthly content calendar of up to 10 custom-branded posts across platforms.', null,10),
('social-premium','Monthly Work','checklist','Deliver monthly content calendar','Send the month''s post schedule and topics to the client for review by the 20th of the prior month.', null,20),
('social-premium','Monthly Work','checklist','Create custom branded graphics','All posts use on-brand custom graphics. No generic stock templates.', null,30),
('social-premium','Monthly Work','checklist','Cross-post blog content','Share any blog published that month as a social post. Include a link and engaging caption.', null,40),
('social-premium','Monthly Work','checklist','Get client content approval','Confirm client has signed off before scheduling. Document approval.', null,50),

('social-premium','Monthly Communications','deliverable','Monthly Marketing Update — Data','Engagement, reach, follower growth, and post-level performance across all platforms including the additional channel.', null,10),
('social-premium','Monthly Communications','deliverable','Next month content calendar','Deliver the upcoming month''s content calendar for client review. Include topics, formats, and target dates.', null,20),
('social-premium','Monthly Communications','deliverable','Monthly Marketing Update — Comms','Second touchpoint: content highlights, upcoming themes, or platform algorithm updates that affect the strategy.', null,30),

('social-premium','Guidelines','guideline','Deliver calendar by the 20th','Content calendar for the next month should be in the client''s hands by the 20th of the current month. Late delivery causes approval bottlenecks and scheduling gaps.', null,10),
('social-premium','Guidelines','guideline','Additional platform gets repurposed content','The bonus platform (Nextdoor, LinkedIn, Twitter) receives adapted versions of the primary content — not original posts. Set this expectation with clients.', null,20),
('social-premium','Guidelines','guideline','Approval is a two-way commitment','If the client does not respond to approval requests within 3 business days, proceed with posting. Document this policy in onboarding.', null,30),

-- ─────────────────────────────────────────────
-- ORM FOUNDATION (orm-foundation)
-- ─────────────────────────────────────────────
('orm-foundation','Initial Setup','checklist','Set up GatherUp for GBP reviews','Configure GatherUp to send automated review requests directing clients to Google Business Profile.', null,10),
('orm-foundation','Initial Setup','checklist','Grant client dashboard access','Set up single sign-on so the client can view reviews and respond across platforms from one place.', null,20),
('orm-foundation','Initial Setup','checklist','Connect major review platforms','Add GBP, Yelp, Healthgrades, and Facebook to the dashboard.', null,30),
('orm-foundation','Initial Setup','checklist','Transition away from closed-loop platforms','If the client uses Demandforce or similar, shift review requests to public GBP instead. Closed-loop reviews are invisible to prospective clients.', null,40),
('orm-foundation','Initial Setup','checklist','Link Basecamp project','Connect client Basecamp project for communications.','basecamp_linked',50),

('orm-foundation','Monthly Work','checklist','Monitor review volume','Track new review count monthly. Flag any month where new reviews drop significantly.', null,10),
('orm-foundation','Monthly Work','checklist','Flag negative reviews within 24 hours','Alert the client to any new negative review within 24 hours of it appearing. Include context and suggested response.', null,20),

('orm-foundation','Monthly Communications','deliverable','Monthly Marketing Update — Data','Review count, average star rating, and velocity trend for the month. Compare to prior month.', null,10),
('orm-foundation','Monthly Communications','deliverable','Monthly Marketing Update — Comms','Second touchpoint: highlight any review wins, flag concerns, or share a tip on encouraging reviews from happy clients.', null,20),

('orm-foundation','Guidelines','guideline','GBP is the priority platform','At Foundation level, all review generation effort funnels to Google Business Profile first. GBP reviews have the highest impact on local search visibility.', null,10),
('orm-foundation','Guidelines','guideline','Client response is their responsibility at Foundation','At Foundation level, we flag reviews but the client responds. Make this clear at onboarding. If they want us to draft or post responses, that is Premium.', null,20),
('orm-foundation','Guidelines','guideline','Volume matters more than perfection','A practice with 200 reviews at 4.3 stars will outperform one with 20 reviews at 5.0 stars in local search. Push for volume.', null,30),

-- ─────────────────────────────────────────────
-- ORM PREMIUM (orm-premium)
-- ─────────────────────────────────────────────
('orm-premium','Initial Setup','checklist','Complete all ORM Foundation setup items','All Foundation requirements must be in place first.', null,5),
('orm-premium','Initial Setup','checklist','Set up ORM reporting dashboard','Configure dedicated reporting showing review velocity, platform breakdown, star rating trend, and competitor comparison.', null,10),
('orm-premium','Initial Setup','checklist','Configure all major review platforms in software','Ensure GBP, Yelp, Healthgrades, Facebook, and any specialty platforms are all connected and monitored.', null,20),

('orm-premium','Monthly Work','checklist','Weekly review velocity tracking','Check new reviews weekly (not just monthly). Catch drops early before they compound.', null,10),
('orm-premium','Monthly Work','checklist','Respond to positive reviews','Draft and post professional responses to positive reviews monthly. Personalize where possible — avoid copy-paste templates.', null,20),
('orm-premium','Monthly Work','checklist','Guided response to negative reviews','Provide a recommended response for any negative review within 24 hours. Get client approval before posting if requested.', null,30),
('orm-premium','Monthly Work','checklist','Competitor reputation gap analysis','Monthly review of top 3 competitors: review count, star rating, and velocity. Flag if a competitor is closing the gap.', null,40),

('orm-premium','Monthly Communications','deliverable','Monthly Marketing Update — Data','Full ORM report: new reviews, velocity trend, star rating movement, platform breakdown, competitor comparison.', null,10),
('orm-premium','Monthly Communications','deliverable','Monthly Marketing Update — Comms','Second touchpoint: reputation wins, concerns, proactive improvement suggestions, or response strategy updates.', null,20),

('orm-premium','Guidelines','guideline','Set monthly review velocity targets','Establish a monthly new review goal based on the current baseline and competitive gap. Share this goal with the client — it gives them something to work toward internally.', null,10),
('orm-premium','Guidelines','guideline','Never ignore a negative review','Every negative review gets a professional response. Silence is interpreted as indifference by both the reviewer and prospective clients reading it.', null,20),
('orm-premium','Guidelines','guideline','Response tone matters','Responses should be warm, professional, and brief. Never defensive. The audience is not the reviewer — it is every future client who reads that response.', null,30);
