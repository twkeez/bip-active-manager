-- Multi-strategist client visibility.
-- A single strategist_user_id can't represent shared assignments (e.g.
-- "Daniel/Tom", "Melissa/Stephanie"), so add an array of assigned strategists
-- and let RLS grant visibility to any of them. strategist_user_id is kept for
-- backward compatibility. The array is populated by
-- scripts/sync-client-strategists.mjs from the marketing_strategist field.

alter table public.clients
  add column if not exists strategist_user_ids uuid[] not null default '{}';

drop policy if exists "clients_select_authenticated" on public.clients;
create policy "clients_select_authenticated" on public.clients for select
  using (
    public.user_role() = 'admin'
    or strategist_user_id = auth.uid()
    or auth.uid() = any (strategist_user_ids)
  );

drop policy if exists "clients_update_authenticated" on public.clients;
create policy "clients_update_authenticated" on public.clients for update
  using (
    public.user_role() = 'admin'
    or strategist_user_id = auth.uid()
    or auth.uid() = any (strategist_user_ids)
  );
