-- Whether we still serve a client: active, cancelling (leaving, still being
-- served) or former. Cancelling and former clients drop off the Response
-- Report's roster into a counted "Excluded" list, with who marked them and
-- when. Nothing else reads this yet.

alter table public.clients
  add column if not exists account_status text not null default 'active',
  add column if not exists account_status_changed_at timestamptz,
  add column if not exists account_status_changed_by text;

alter table public.clients
  drop constraint if exists clients_account_status_check;
alter table public.clients
  add constraint clients_account_status_check
  check (account_status in ('active', 'cancelling', 'former'));
