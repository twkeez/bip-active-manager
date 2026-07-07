-- Add a City field to clients, used to build the default "veterinarian in <city>"
-- tracked keyword and other location-based copy.
alter table public.clients
  add column if not exists city text;
