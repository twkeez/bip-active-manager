-- Store the AI-drafted PPC campaign plan (ad groups + budget notes + merged
-- negative keywords) from the "Campaign plan + negative keywords" step.
alter table public.client_onboarding_intake
  add column if not exists campaign_plan jsonb,
  add column if not exists campaign_plan_at timestamptz;
