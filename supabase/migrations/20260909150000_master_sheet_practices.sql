-- The master sheet: the list of practices we actually serve.
--
-- Needed on the wiring screen because neither Basecamp nor our client records
-- can answer "is this a live client?". Of 53 Basecamp projects with no client
-- record, 39 were current practices whose names simply differ from Basecamp's,
-- and only those absent from the sheet AND silent for over a year were safe to
-- ignore. Without the sheet that is 53 individual judgement calls.
--
-- Replaced wholesale on each upload: the sheet is the source of truth and a
-- practice dropping off it is meaningful.

create table if not exists public.master_sheet_practices (
  id bigint generated always as identity primary key,
  practice_name text not null,
  normalized_name text not null,
  url text,
  city text,
  state text,
  package_value text,
  strategist text,
  imported_at timestamptz not null default now(),
  imported_by text
);

create unique index if not exists idx_master_sheet_normalized
  on public.master_sheet_practices (normalized_name);

alter table public.master_sheet_practices enable row level security;

grant select on public.master_sheet_practices to authenticated;

drop policy if exists "master_sheet_select_authenticated" on public.master_sheet_practices;
create policy "master_sheet_select_authenticated"
  on public.master_sheet_practices
  for select
  to authenticated
  using (true);
