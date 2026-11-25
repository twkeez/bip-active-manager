import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncReportingToBigQuery } from "@/lib/reporting/bigquery-sync";

type SyncRequestBody = {
  metricDate?: string;
};

export async function POST(request: Request) {
  // Runs BigQuery jobs with the service key, so admins only.
  const auth = await requireAdminRole();
  if ("response" in auth) return auth.response;

  let body: SyncRequestBody = {};
  try {
    body = (await request.json()) as SyncRequestBody;
  } catch {
    body = {};
  }

  try {
    const admin = createAdminClient();
    const sync = await syncReportingToBigQuery({
      admin,
      metricDate: body.metricDate,
    });
    return NextResponse.json({ ok: true, ...sync });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed BigQuery reporting sync",
      },
      { status: 500 },
    );
  }
}
