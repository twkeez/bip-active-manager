-- What people decided about an ads finding, so it survives a reload and the
-- whole team sees it. Until now Mute and Flag on Conversion Integrity, the
-- dismiss button on PPC Defense, and Ignore/Snooze on a client's Ads tab only
-- lived in the browser tab: they looked saved, and came back on reload.
--
--   tool          which page the finding is on
--   finding_key   the finding's own id on that page, e.g. "74:123:pixel_loop"
--   state         muted | flagged | dismissed | snoozed
--   snoozed_until a snooze ends by itself
--
-- Server-only: row-level security on with no policies, like the other tables
-- written through the app's own API.

create table if not exists public.ads_finding_states (
  id bigint generated always as identity primary key,
  tool text not null check (tool in ('conversion_integrity', 'ppc_defense', 'ads_playbook')),
  finding_key text not null,
  client_id bigint references public.clients(id) on delete cascade,
  state text not null check (state in ('muted', 'flagged', 'dismissed', 'snoozed')),
  snoozed_until timestamptz,
  set_by text,
  created_at timestamptz not null default now(),
  unique (tool, finding_key, state)
);

alter table public.ads_finding_states enable row level security;
