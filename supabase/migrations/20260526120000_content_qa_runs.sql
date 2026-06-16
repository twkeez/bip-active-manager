create table if not exists public.content_qa_runs (
  id bigint generated always as identity primary key,
  client_id bigint references public.clients(id) on delete set null,
  google_doc_url text,
  source text not null check (source in ('paste', 'google_doc', 'docx')),
  report jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_qa_runs_client_created
  on public.content_qa_runs (client_id, created_at desc);

grant select, insert on public.content_qa_runs to authenticated;

alter table public.content_qa_runs enable row level security;

create policy "content_qa_runs_select_authenticated"
  on public.content_qa_runs
  for select
  to authenticated
  using (true);

create policy "content_qa_runs_insert_authenticated"
  on public.content_qa_runs
  for insert
  to authenticated
  with check (auth.uid() = created_by);
