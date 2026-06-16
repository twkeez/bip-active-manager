import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBigQueryDatasetRef, runBigQueryQuery } from "@/lib/reporting/bigquery";

type HealthRow = {
  metric_date: string;
  clients: number;
  avg_urgency_score: number;
  null_client_name_rows: number;
  keyword_rows: number;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { datasetFqn } = getBigQueryDatasetRef();
    const rows = await runBigQueryQuery<HealthRow>(`
      with latest as (
        select max(metric_date) as metric_date
        from ${datasetFqn}.client_daily_metrics
      )
      select
        cast(l.metric_date as string) as metric_date,
        count(distinct m.client_id) as clients,
        avg(m.urgency_score) as avg_urgency_score,
        countif(m.client_name is null or trim(m.client_name) = '') as null_client_name_rows,
        (
          select count(*)
          from ${datasetFqn}.client_keyword_facts k
          where k.metric_date = l.metric_date
        ) as keyword_rows
      from latest l
      left join ${datasetFqn}.client_daily_metrics m
        on m.metric_date = l.metric_date
      group by l.metric_date
    `);
    return NextResponse.json({ ok: true, health: rows[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed BigQuery health check",
      },
      { status: 500 },
    );
  }
}
