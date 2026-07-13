-- Illuminare is a separate portfolio from the vet-focused `clients` table.
-- Kept isolated so nothing here tangles with Beyond Indigo client logic.
-- Deliverables, strategy/goals, and Basecamp connection live in follow-up tables.
create table if not exists public.illuminare_clients (
  id bigint generated always as identity primary key,
  account_name text not null,
  account_lead text,                     -- who runs the account on our side
  status text not null default 'active', -- active | onboarding | paused | offboarded
  website text,
  basecamp_project_id text,              -- project id in the Illuminare Basecamp account
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.illuminare_clients is 'Illuminare portfolio client accounts (separate from public.clients)';

alter table public.illuminare_clients enable row level security;

-- Mirror the access model used by public.clients: any authenticated dashboard user.
create policy "illuminare_clients_select_authenticated"
  on public.illuminare_clients
  for select
  to authenticated
  using (true);

create policy "illuminare_clients_insert_authenticated"
  on public.illuminare_clients
  for insert
  to authenticated
  with check (true);

create policy "illuminare_clients_update_authenticated"
  on public.illuminare_clients
  for update
  to authenticated
  using (true)
  with check (true);

create policy "illuminare_clients_delete_authenticated"
  on public.illuminare_clients
  for delete
  to authenticated
  using (true);

-- Seed the initial roster.
insert into public.illuminare_clients (account_name)
values
  ('Center for Psychological Discovery'),
  ('Dr. Kohutis'),
  ('Jen Liam, LCSW CPT'),
  ('Shining the Light Podcast'),
  ('The Crow River Market'),
  ('The Front Porch Shop'),
  ('Twin Blade Outdoor Services'),
  ('UFVD'),
  ('BAKE!'),
  ('G&T Goat Milk Soaps LLC'),
  ('Diane Eigner'),
  ('Carla Matias Counseling'),
  ('Ana Coronado'),
  ('Minnetonka Animal Hospital');
