-- Prevent cross-project overwrites for Basecamp events.

alter table public.basecamp_communication_events
  drop constraint if exists basecamp_communication_events_basecamp_recording_id_kind_key;

alter table public.basecamp_communication_events
  add constraint basecamp_communication_events_project_recording_kind_key
  unique (basecamp_project_id, basecamp_recording_id, kind);
