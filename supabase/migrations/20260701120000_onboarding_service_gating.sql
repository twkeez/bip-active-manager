-- Service-gate onboarding checklist items: an item with a requires_service is
-- only seeded for clients who bought that service. Null = always applies.

alter table public.client_onboarding_templates
  add column if not exists requires_service text
    check (requires_service is null or requires_service in ('blog', 'smm', 'seo', 'ppc', 'orm'));

alter table public.client_onboarding_items
  add column if not exists requires_service text
    check (requires_service is null or requires_service in ('blog', 'smm', 'seo', 'ppc', 'orm'));

-- Tag the service-specific template items. Shared items stay null.
update public.client_onboarding_templates set requires_service = 'seo'
  where item_key in ('conn_search_console', 'conn_place_id', 'launch_baseline_seo', 'launch_keywords');
update public.client_onboarding_templates set requires_service = 'ppc'
  where item_key in ('conn_google_ads');
update public.client_onboarding_templates set requires_service = 'smm'
  where item_key in ('conn_social');
