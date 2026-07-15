-- Editable "best practices" store: the constants Tom maintains (universal PPC
-- negatives, the campaign skeleton, constant keywords). The onboarding assists
-- combine these with AI only for the practice-specific variances.
create table if not exists public.best_practices (
  id bigint generated always as identity primary key,
  key text not null unique,
  label text not null,
  category text not null default 'General',
  content text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.best_practices to authenticated;

alter table public.best_practices enable row level security;

create policy "best_practices_select_authenticated"
  on public.best_practices for select to authenticated using (true);

insert into public.best_practices (key, label, category, content, sort_order) values
  ('constant_keywords', 'Constant keywords (always include)', 'SEO',
'vet near me
veterinarian near me
animal hospital near me
emergency vet near me', 10),
  ('ppc_negatives', 'PPC negative keywords', 'PPC',
'free
jobs
careers
job
salary
volunteer
intern
internship
school
student
course
class
training
wildlife
zoo
SPCA
humane society
shelter
rescue
adoption
adopt
DIY
how to', 20),
  ('ppc_campaign_skeleton', 'PPC campaign skeleton', 'PPC',
'Standard ad groups (by service):
- New client / vet near me
- Wellness & preventive care
- Dental
- Emergency / urgent care
- Surgery / spay & neuter

Guidance:
- Weight budget toward emergency + new-client groups.
- Use call, location, and sitelink extensions.
- Tight, single-theme ad groups; exact + phrase match.', 30)
on conflict (key) do nothing;
