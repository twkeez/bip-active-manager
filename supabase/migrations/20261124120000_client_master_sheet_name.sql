-- The name a client goes by on Master Sheet 2026, for the few whose BIP Control
-- name differs from the sheet's ("Birchwood Pet Hospital" here, "Birchwood Pet
-- Hospital and Cat Clinic" there). The Response Report's roster matches a sheet
-- row to a client by exact name; this is the saved answer when the names differ,
-- so nothing is ever matched by guesswork.

alter table public.clients
  add column if not exists master_sheet_name text;

comment on column public.clients.master_sheet_name is
  'This client''s Practice Name on Master Sheet 2026, when it differs from account_name.';
