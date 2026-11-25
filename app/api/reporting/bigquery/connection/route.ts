import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth/guard";
import {
  ensureBigQueryDataset,
  getBigQueryDatasetRef,
  runBigQueryQuery,
} from "@/lib/reporting/bigquery";

type ProbeRow = {
  one: number;
};

export async function GET() {
  // Runs BigQuery jobs with the service key, so admins only.
  const auth = await requireAdminRole();
  if ("response" in auth) return auth.response;
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
