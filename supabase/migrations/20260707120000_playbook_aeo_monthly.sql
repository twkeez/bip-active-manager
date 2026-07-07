-- Add AEO monthly checklist item for seo-premium-plus.
-- Previously only existed as a guideline; this adds the actionable monthly task.
insert into public.playbook_items (tier_key, category, type, title, body, auto_verify_key, sort_order)
values (
  'seo-premium-plus',
  'Monthly Work',
  'checklist',
  'Review and update AEO / llms.txt content',
  'Check that llms.txt is current with any new services, doctors, or hours. Review AI overview appearances in Google Search for branded and high-intent queries. Note any new citations or missed opportunities and update content accordingly.',
  null,
  35
);
