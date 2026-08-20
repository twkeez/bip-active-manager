-- Reset the needs_action flag.
--
-- Sync was setting needs_action on every non-blacklisted message, so all 1,162
-- stored emails were flagged and the "Needs action" view was just a copy of the
-- inbox. The sync bug is fixed in lib/gmail/sync.ts; this clears the damage.
--
-- Messages that were turned into a task keep their flag — that one was set
-- deliberately and is the only place the flag currently means what it says.

update public.user_email_messages
   set needs_action = false,
       updated_at = now()
 where needs_action = true
   and task_id is null;
