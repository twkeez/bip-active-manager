import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncReportingToBigQuery } from "@/lib/reporting/bigquery-sync";
import { getBigQueryDatasetRef, runBigQueryQuery } from "@/lib/reporting/bigquery";

type ValidationRow = {
  client_count: number;
  latest_metric_date: string;
};

export async function POST() {
  // Runs BigQuery jobs with the service key, so admins only.
  const auth = await requireAdminRole();
  if ("response" in auth) return auth.response;

  try {
    const admin = createAdminClient();
    const sync = await syncReportingToBigQuery({ admin });
    const { datasetFqn } = getBigQueryDatasetRef();
    const rows = await runBigQueryQuery<ValidationRow>(`
      select
        count(distinct client_id) as client_count,
        cast(max(metric_date) as string) as latest_metric_date
      from ${datasetFqn}.client_daily_metrics
    `);
    return NextResponse.json({
      ok: true,
      sync,
      validation: rows[0] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed BigQuery validation",
      },
      { status: 500 },
    );
  }
}
