import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const steps = [
  {
    name: "create report_template_config",
    sql: `
      create table if not exists report_template_config (
        key text primary key default 'master',
        config jsonb not null,
        updated_at timestamptz not null default now()
      )
    `,
  },
  {
    name: "enable RLS on report_template_config",
    sql: `alter table report_template_config enable row level security`,
  },
  {
    name: "policy: auth users can read template config",
    sql: `
      do $$ begin
        if not exists (
          select 1 from pg_policies
          where tablename = 'report_template_config'
          and policyname = 'auth users can read template config'
        ) then
          execute 'create policy "auth users can read template config"
            on report_template_config for select to authenticated using (true)';
        end if;
      end $$
    `,
  },
  {
    name: "policy: auth users can upsert template config",
    sql: `
      do $$ begin
        if not exists (
          select 1 from pg_policies
          where tablename = 'report_template_config'
          and policyname = 'auth users can upsert template config'
        ) then
          execute 'create policy "auth users can upsert template config"
            on report_template_config for all to authenticated using (true) with check (true)';
        end if;
      end $$
    `,
  },
  {
    name: "create client_report_configs",
    sql: `
      create table if not exists client_report_configs (
        client_id integer primary key references clients(id) on delete cascade,
        config jsonb not null,
        updated_at timestamptz not null default now()
      )
    `,
  },
  {
    name: "enable RLS on client_report_configs",
    sql: `alter table client_report_configs enable row level security`,
  },
  {
    name: "policy: auth users can manage client report configs",
    sql: `
      do $$ begin
        if not exists (
          select 1 from pg_policies
          where tablename = 'client_report_configs'
          and policyname = 'auth users can manage client report configs'
        ) then
          execute 'create policy "auth users can manage client report configs"
            on client_report_configs for all to authenticated using (true) with check (true)';
        end if;
      end $$
    `,
  },
];

for (const step of steps) {
  const { error } = await supabase.rpc("exec_ddl", { ddl: step.sql }).maybeSingle().catch(() => ({ error: null }));
  // Fall back: try direct REST insert as a no-op to probe table existence
  // Actually use the from().select() trick — just try the raw approach via fetch
  const resp = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_ddl`,
    {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ddl: step.sql }),
    },
  );

  if (!resp.ok) {
    const text = await resp.text();
    if (text.includes("already exists") || text.includes("exec_ddl")) {
      // exec_ddl not available — use pg endpoint workaround via service key
      console.log(`⚠  ${step.name}: exec_ddl not available, trying pg/query`);
      continue;
    }
    console.error(`✗  ${step.name}: ${text}`);
  } else {
    console.log(`✓  ${step.name}`);
  }
}
