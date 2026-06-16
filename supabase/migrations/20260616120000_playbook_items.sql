-- Playbook items: best practices per service tier
create table if not exists public.playbook_items (
  id serial primary key,
  tier_key text not null references public.strategy_mapper_service_tiers(tier_key) on delete cascade,
  category text not null default 'General',
  type text not null default 'checklist' check (type in ('checklist', 'deliverable', 'guideline')),
  title text not null,
  body text,
  auto_verify_key text, -- e.g. 'gsc_connected', 'ads_synced', 'gbp_connected', null = manual
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookup by tier
create index if not exists playbook_items_tier_key_idx on public.playbook_items(tier_key);

-- RLS
alter table public.playbook_items enable row level security;

-- Anyone authenticated can read
create policy "Authenticated users can read playbook items"
  on public.playbook_items for select
  using (auth.role() = 'authenticated');

-- Only admins can write
create policy "Admins can manage playbook items"
  on public.playbook_items for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger playbook_items_updated_at
  before update on public.playbook_items
  for each row execute procedure public.set_updated_at();
