-- Allow authenticated dashboard users to read and manage clients.
create policy "clients_select_authenticated"
  on public.clients
  for select
  to authenticated
  using (true);

create policy "clients_insert_authenticated"
  on public.clients
  for insert
  to authenticated
  with check (true);

create policy "clients_update_authenticated"
  on public.clients
  for update
  to authenticated
  using (true)
  with check (true);

create policy "clients_delete_authenticated"
  on public.clients
  for delete
  to authenticated
  using (true);
