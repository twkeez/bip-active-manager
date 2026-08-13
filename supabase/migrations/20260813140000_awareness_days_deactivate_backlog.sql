-- Fix: the awareness-day port in 20260813130000 omitted is_active from its
-- INSERT column list, so all 37 rows took the column default (true) instead of
-- landing dormant. They are unverified AI-generated entries and must not be
-- usable until a human checks them.

-- 1. Deactivate the review backlog that was activated by mistake.
update public.social_awareness_days
   set is_active = false,
       updated_at = now()
 where verified = false
   and is_active = true;

-- 2. Flip the column default so the mistake cannot recur. A new row is dormant
--    until someone deliberately activates it. (The original spec said
--    DEFAULT true; false is the safer default for a table whose whole point is
--    human-verified provenance, and it matches the stated rule that nothing
--    unverified may surface.)
alter table public.social_awareness_days
  alter column is_active set default false;
