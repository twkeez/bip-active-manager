-- Services reference library: a shared repository of documents and links for
-- strategists (brand guides, tier breakdowns, templates, etc.). Team-readable;
-- admins curate. Files reuse the existing "task-documents" storage bucket under a
-- "service-library/" path prefix (no new bucket needed).

create table if not exists public.service_library_items (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('link', 'file')),
  label text not null check (char_length(trim(label)) > 0),
  category text not null default 'General',
  url text,
  storage_path text,
  file_name text,
  mime_type text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A link needs a url; a file needs a storage path + name.
  check (
    (kind = 'link' and url is not null)
    or (kind = 'file' and storage_path is not null and file_name is not null)
  )
);

create index if not exists idx_service_library_items_category_sort
  on public.service_library_items (category, sort_order, id);

grant select on public.service_library_items to authenticated;

alter table public.service_library_items enable row level security;

-- Everyone on the team can read; writes go through an admin-gated API route
-- (service role), so no insert/update/delete policy is granted to authenticated.
create policy "service_library_items_select_authenticated"
  on public.service_library_items for select to authenticated using (true);
