import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ensureBigQueryDataset,
  getBigQueryDatasetRef,
  runBigQueryQuery,
} from "@/lib/reporting/bigquery";

type ProbeRow = {
  one: number;
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
    const dataset = await ensureBigQueryDataset();
    const probe = await runBigQueryQuery<ProbeRow>("select 1 as one");
    const { datasetId, projectId } = getBigQueryDatasetRef();
    return NextResponse.json({
      ok: true,
      projectId,
      datasetId,
      datasetExists: true,
      location: dataset.location ?? null,
      probeResult: probe[0]?.one ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "BigQuery connection check failed",
      },
      { status: 500 },
    );
  }
}
