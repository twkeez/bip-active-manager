-- Edits to a client's document, made before it is printed.
--
-- The client document is built from shared wording plus that client's plan and
-- research. Some of it needs changing for one practice — a timing line, a
-- sentence of research, a recommendation that does not fit — without touching
-- the wording every other client gets. One row per edited section, for one
-- client. No row means the standard wording is used; deleting the row is
-- "back to standard wording".
--
-- An edited section is a copy: it stops following later changes to the
-- standard wording. The editor marks edited sections so that is visible.

create table if not exists public.client_document_edits (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  -- Which section, e.g. 'intro', 'plan.timing', 'service:seo:expect',
  -- 'market.competitor:Alto Tiburon Veterinary Hospital'. Validated by the app.
  section_key text not null,
  -- Replacement text. Null when the row only hides the section.
  body text,
  -- Leave this section out of the document entirely.
  hidden boolean not null default false,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, section_key)
);

create index if not exists idx_client_document_edits_client
  on public.client_document_edits (client_id);

alter table public.client_document_edits enable row level security;

grant select on public.client_document_edits to authenticated;

drop policy if exists "client_document_edits_select_authenticated" on public.client_document_edits;
create policy "client_document_edits_select_authenticated"
  on public.client_document_edits
  for select
  to authenticated
  using (true);

-- Writes go through the app's API with the service role, which checks the
-- person is signed in — the same rule as the strategist note, which anyone who
-- can open the client may edit.
