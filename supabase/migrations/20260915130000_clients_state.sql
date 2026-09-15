-- The other half of a location.
--
-- clients.city has existed for a while; state never did, so "Marietta" alone
-- had to stand for a place — and there are Mariettas in Georgia, Ohio and
-- Pennsylvania. Local research, keyword volume and the expectations copy all
-- read the location, and the master sheet already carries city and state
-- separately, so this is the shape the data arrives in anyway.
--
-- Nullable and unused by default: nothing reads it yet, and 37 of 253 clients
-- do not even have a city.

alter table public.clients
  add column if not exists state text;

comment on column public.clients.state is
  'Two-letter US state or Canadian province, paired with clients.city.';
