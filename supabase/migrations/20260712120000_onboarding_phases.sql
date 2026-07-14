-- Phase onboarding steps into "foundation" (do now) and "at_launch" (deferred
-- until the site launches). Connection + go-live steps can't happen for a brand-
-- new practice with no site/accounts yet, so they wait for the launch milestone.

alter table public.client_onboarding_templates
  add column if not exists phase text not null default 'foundation'
  check (phase in ('foundation', 'at_launch'));

alter table public.client_onboarding_items
  add column if not exists phase text not null default 'foundation'
  check (phase in ('foundation', 'at_launch'));

-- Site/account-dependent steps → at_launch. Everything else stays foundation.
update public.client_onboarding_templates set phase = 'at_launch'
  where item_key in (
    'conn_website',
    'conn_search_console',
    'conn_google_ads',
    'conn_social',
    'conn_ga4',
    'conn_place_id',
    'launch_baseline_seo',
    'launch_reporting_prefs'
  );

-- Backfill already-seeded per-client items from their template phase.
update public.client_onboarding_items i
  set phase = t.phase
  from public.client_onboarding_templates t
  where t.item_key = i.item_key;

-- The launch milestone. Null = not launched yet (at_launch steps deferred).
alter table public.client_onboarding_intake
  add column if not exists website_launched_at timestamptz;
