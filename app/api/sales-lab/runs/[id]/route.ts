import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  SalesProspectAiOutputs,
  SalesProspectAudit,
  SalesProspectRun,
} from "@/lib/types/client";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Params) {
  const { id } = await context.params;
  const runId = Number(id);
  if (!Number.isInteger(runId) || runId <= 0) {
    return NextResponse.json({ error: "Invalid run id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: run, error: runError } = await supabase
    .from("sales_prospect_runs")
    .select("*")
    .eq("id", runId)
    .eq("created_by", user.id)
    .maybeSingle<SalesProspectRun>();
  if (runError || !run) {
    return NextResponse.json(
      { error: runError?.message ?? "Sales run not found." },
      { status: 404 },
    );
  }

  const [{ data: audit }, { data: aiOutputs }] = await Promise.all([
    supabase
      .from("sales_prospect_audits")
      .select("*")
      .eq("run_id", runId)
      .maybeSingle<SalesProspectAudit>(),
    supabase
      .from("sales_prospect_ai_outputs")
      .select("*")
      .eq("run_id", runId)
      .maybeSingle<SalesProspectAiOutputs>(),
  ]);

  return NextResponse.json({
    ok: true,
    run,
    audit: audit ?? null,
    aiOutputs: aiOutputs ?? null,
  });
}
