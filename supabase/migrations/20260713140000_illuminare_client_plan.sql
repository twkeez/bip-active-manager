-- Account plan + strategy fields for Illuminare clients, plus basic profile fields
-- (the roster was seeded with names only). All narrative/editable on the detail page.
alter table public.illuminare_clients
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists engagement_type text,   -- 'retainer' | 'project' | 'hybrid'
  add column if not exists scope_summary text,      -- what we're contracted to do
  add column if not exists retainer_notes text,     -- budget / hours / billing notes
  add column if not exists goals text,              -- what the client wants to achieve
  add column if not exists strategy text,           -- how we're approaching it
  add column if not exists progress_notes text;     -- running progress log
