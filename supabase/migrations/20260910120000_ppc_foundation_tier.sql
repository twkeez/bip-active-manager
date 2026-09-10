-- Add a PPC Foundation tier. clients.ppc = 'Foundation' used to fall through to
-- ppc-premium; the published scope table (and the plan editor) has three PPC
-- tiers — Foundation / Premium / Premium Plus — so the catalogue now does too.
-- Foundation takes rank 1; Premium and Premium Plus move up to 2 and 3.

insert into public.strategy_mapper_service_tiers
  (tier_key, service, tier_label, tier_rank, title, objective, tactics, match_aliases)
values
  (
    'ppc-foundation',
    'ppc',
    'Ads Foundation',
    1,
    'Pay-Per-Click Advertising (PPC) — Foundation',
    'Establish a focused, fully tracked paid presence for [Practice Name] on a single channel, putting one tightly scoped campaign in front of local pet parents who are actively looking for care in [Practice Location].',
    '[
      "Single-Channel Campaign Build: Audit the existing ad account or build a new one, then launch one structured campaign on the channel that fits [Practice Name] best (Google Search or a single social platform), targeted to your local market.",
      "Conversion Tracking Foundation: Configure call, form, and appointment-request conversion tracking (or the platform pixel) so every dollar of ad spend can be tied to a real client action from day one.",
      "Baseline Keyword & Audience Targeting: Build core keyword research or interest targeting for one market, and adjust bids as needed to keep spend pointed at high-intent local prospects."
    ]'::jsonb,
    array['Ads Foundation', 'PPC Foundation', 'Google Ads Foundation', 'Foundation PPC', 'Paid Ads Foundation']
  )
on conflict (tier_key) do nothing;

update public.strategy_mapper_service_tiers
  set tier_rank = 2, updated_at = now()
  where tier_key = 'ppc-premium';

update public.strategy_mapper_service_tiers
  set tier_rank = 3, updated_at = now()
  where tier_key = 'ppc-premium-plus';

-- Starter playbook items, scoped to the Foundation column of the published
-- table: one channel, one campaign, one market, bids as needed, no A/B testing.
insert into public.playbook_items (tier_key, category, type, title, body, auto_verify_key, sort_order)
select * from (values
  ('ppc-foundation','Initial Setup','checklist','Confirm the one channel with the client','Foundation covers a single channel — Google Search or one social platform. Agree which one before any build work and note it in Basecamp.', null::text,10),
  ('ppc-foundation','Initial Setup','checklist','Get access to the ad account','For Google, link the account to the BIP agency MCC. For a social platform, confirm admin access to the ad account. Confirm access before any campaign work begins.', null,20),
  ('ppc-foundation','Initial Setup','checklist','Audit the existing account or build a new one','If the client already has an account, audit it for wasted spend and broken tracking. Otherwise build it fresh.', null,30),
  ('ppc-foundation','Initial Setup','checklist','Configure conversion / pixel tracking','Track calls, form submissions, and appointment requests (or install the platform pixel). Every meaningful client action must be tracked.', null,40),
  ('ppc-foundation','Initial Setup','checklist','Basic keyword research or interest targeting','One market only. Focus on high-intent local terms ("vet near me," "veterinarian [City]") or the closest matching interest audience.', null,50),
  ('ppc-foundation','Initial Setup','checklist','Launch the single campaign','Build and launch one campaign with one clear objective. Up to 2 ad sets per month.', null,60),
  ('ppc-foundation','Initial Setup','checklist','Link Basecamp project','Connect client Basecamp project for communications.','basecamp_linked',70),

  ('ppc-foundation','Monthly Work','checklist','Bid adjustments as needed','Review cost-per-click and conversions. Adjust bids where spend is drifting away from high-intent local traffic.', null,10),
  ('ppc-foundation','Monthly Work','checklist','Budget pacing check','Confirm spend is pacing correctly against the monthly budget. Adjust daily budgets if underspending or at risk of overspending.', null,20),
  ('ppc-foundation','Monthly Work','checklist','Search term / audience check','Scan for obviously irrelevant searches or audiences and exclude them.', null,30),

  ('ppc-foundation','Monthly Communications','deliverable','Monthly Marketing Update — Data','Ads performance report: spend, impressions, clicks, conversions, cost per conversion. Compare to the prior month.', null,10),
  ('ppc-foundation','Monthly Communications','deliverable','Monthly Marketing Update — Comms','Second touchpoint: what the campaign did this month and any adjustments coming up.', null,20),

  ('ppc-foundation','Guidelines','guideline','One channel, one campaign','Foundation is scoped to a single channel and a single campaign in one market. More channels, campaign types, or markets are Premium scope — raise it as an upsell rather than absorbing it.', null,10),
  ('ppc-foundation','Guidelines','guideline','No structured A/B testing at this tier','Bid adjustments as needed only. Ad copy and creative A/B testing starts at Premium.', null,20),
  ('ppc-foundation','Guidelines','guideline','Ad spend is billed directly','The client pays the platform for ad spend directly. It is never part of the management fee.', null,30)
) as v(tier_key, category, type, title, body, auto_verify_key, sort_order)
where not exists (
  select 1 from public.playbook_items where tier_key = 'ppc-foundation'
);
