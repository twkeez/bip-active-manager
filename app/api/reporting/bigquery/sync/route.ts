import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncReportingToBigQuery } from "@/lib/reporting/bigquery-sync";

type SyncRequestBody = {
  metricDate?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
