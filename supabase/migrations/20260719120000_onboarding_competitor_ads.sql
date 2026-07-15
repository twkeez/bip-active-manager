-- Store the competitor-ad lookup (DataForSEO SERP paid results) run from the
-- PPC "Competitor ad check" onboarding step.
alter table public.client_onboarding_intake
  add column if not exists competitor_ads jsonb,
  add column if not exists competitor_ads_at timestamptz;
