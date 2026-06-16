create table if not exists public.user_focus_daily (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  focus_date date not null,
  top_item_ids jsonb not null default '[]'::jsonb,
  review_notes text,
  review_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, focus_date)
);

create index if not exists idx_user_focus_daily_owner_date
  on public.user_focus_daily (owner_user_id, focus_date desc);

grant select, insert, update, delete on public.user_focus_daily to authenticated;

alter table public.user_focus_daily enable row level security;

create policy "user_focus_daily_select_own"
  on public.user_focus_daily
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "user_focus_daily_insert_own"
  on public.user_focus_daily
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "user_focus_daily_update_own"
  on public.user_focus_daily
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "user_focus_daily_delete_own"
  on public.user_focus_daily
  for delete to authenticated
  using (owner_user_id = auth.uid());
