alter table public.clients
  add column if not exists google_place_id text;
