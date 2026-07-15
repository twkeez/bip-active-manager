-- Rename the PPC competitor step from "ad check" (SERP ads, which don't exist
-- for vets) to "Research competitor offers" (AI web-search).

update public.client_onboarding_templates
  set label = 'Research competitor offers',
      guidance = 'Research what competitors are promoting.
1. Click Research competitor offers — AI web-searches the local market.
2. Review each competitor''s offers, positioning, and how to counter.
3. Use it to shape our campaigns and messaging.'
  where item_key = 'ppc_competitor_ads';

update public.client_onboarding_items
  set label = 'Research competitor offers',
      guidance = 'Research what competitors are promoting.
1. Click Research competitor offers — AI web-searches the local market.
2. Review each competitor''s offers, positioning, and how to counter.
3. Use it to shape our campaigns and messaging.'
  where item_key = 'ppc_competitor_ads';
