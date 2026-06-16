alter table public.clients
  add column if not exists reply_acknowledged_at timestamptz,
  add column if not exists reply_acknowledged_for_occurred_at timestamptz;

create index if not exists idx_clients_reply_acknowledged_for_occurred_at
  on public.clients (reply_acknowledged_for_occurred_at desc);
