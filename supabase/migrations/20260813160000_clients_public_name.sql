-- Client-facing display name for copy that clients actually read.
--
-- account_name is the internal label and often carries group prefixes
-- ("RPVH - MarketPlace Veterinary Hospital"), which reads wrong in a caption.
-- public_name overrides it for client-facing output only.
--
-- NULL means "no override — use account_name". Deliberately not backfilled:
-- a null here is meaningful, and guessing at display names would be worse than
-- leaving the existing behaviour in place.

alter table public.clients
  add column if not exists public_name text null;

comment on column public.clients.public_name is
  'Client-facing practice name used in generated copy. NULL = fall back to account_name. account_name remains the internal identifier.';
