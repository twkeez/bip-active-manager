-- Site scope copy: neutral launch-step wording in content library (runtime variants still apply in code)

update public.strategy_mapper_content_blocks
set
  payload = jsonb_set(
    payload,
    '{description}',
    '"Collect GBP admin, analytics access, platform credentials, and creative assets referenced in sales context for [Practice Name]."'::jsonb
  ),
  updated_at = now()
where block_key = 'launch-step-2';
