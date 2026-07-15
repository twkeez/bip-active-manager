-- Store the AI discovery research (competitors, market snapshot, search
-- landscape) run from the "Prep the strategist" onboarding step.
alter table public.client_onboarding_intake
  add column if not exists discovery jsonb,
  add column if not exists discovery_at timestamptz;
