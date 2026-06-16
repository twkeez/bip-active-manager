import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  executeAuditStage,
  getOwnedAuditRun,
} from "@/lib/site-audit/orchestrator";
import { parseAuditRunId } from "@/lib/site-audit/shared";
import { AUDIT_STAGES, type AuditStage } from "@/lib/site-audit/types";

function isAuditStage(value: string): value is AuditStage {
  return (AUDIT_STAGES as readonly string[]).includes(value);
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; stage: string }> },
) {
  const params = await context.params;
  const runId = parseAuditRunId(params.id);
  if (!runId) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }
  if (!isAuditStage(params.stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getOwnedAuditRun(supabase, user.id, runId);
  if (!existing) {
    return NextResponse.json({ error: "Audit run not found" }, { status: 404 });
  }

  try {
    const run = await executeAuditStage(supabase, user.id, existing, params.stage);
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stage failed" },
      { status: 500 },
    );
  }
}
