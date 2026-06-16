import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnedAuditRun } from "@/lib/site-audit/orchestrator";
import { parseAuditRunId } from "@/lib/site-audit/shared";
import type { WebsiteAuditRun } from "@/lib/site-audit/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const runId = parseAuditRunId(params.id);
  if (!runId) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await getOwnedAuditRun(supabase, user.id, runId);
  if (!run) {
    return NextResponse.json({ error: "Audit run not found" }, { status: 404 });
  }
  return NextResponse.json({ run });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const runId = parseAuditRunId(params.id);
  if (!runId) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("website_audit_runs")
    .delete()
    .eq("id", runId)
    .eq("owner_user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
