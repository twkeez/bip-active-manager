-- Move "Low Contact" off the free-text `tier` column onto its own flag.
--
-- `tier` mixes two unrelated ideas: the plan a client is on (Core / Growth /
-- Enterprise, which are being retired) and whether the account is a quiet one.
-- Only the second is load-bearing — Low Contact clients list as Paused and are
-- exempt from the Basecamp and Harvest setup checks. Splitting them means the
-- plan tiers can be cleared without taking that behaviour with them.
--
-- Safe to run before the matching code deploys: nothing reads the column yet,
-- and the app falls back to the old tier text until it does.

alter table clients
  add column if not exists is_low_contact boolean not null default false;

comment on column clients.is_low_contact is
  'Quiet account: no Basecamp/Harvest expected, lists as Paused. Replaces tier = ''Low Contact''.';

update clients
set is_low_contact = true
where lower(btrim(coalesce(tier, ''))) = 'low contact';
