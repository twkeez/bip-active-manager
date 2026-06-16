create table if not exists public.basecamp_internal_identities (
  id bigint generated always as identity primary key,
  basecamp_person_id bigint,
  email text,
  email_domain text,
  is_internal boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basecamp_internal_identities_identifier_check check (
    basecamp_person_id is not null or email is not null or email_domain is not null
  )
);

create unique index if not exists idx_basecamp_internal_identities_person
  on public.basecamp_internal_identities (basecamp_person_id)
  where basecamp_person_id is not null;

create unique index if not exists idx_basecamp_internal_identities_email
  on public.basecamp_internal_identities ((lower(email)))
  where email is not null;

create unique index if not exists idx_basecamp_internal_identities_domain
  on public.basecamp_internal_identities (email_domain)
  where email_domain is not null;

grant select on public.basecamp_internal_identities to authenticated;

alter table public.basecamp_internal_identities enable row level security;

drop policy if exists "basecamp_internal_identities_select_authenticated" on public.basecamp_internal_identities;
create policy "basecamp_internal_identities_select_authenticated"
  on public.basecamp_internal_identities
  for select
  to authenticated
  using (true);
