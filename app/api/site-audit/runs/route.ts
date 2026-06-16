import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuditUrl } from "@/lib/site-audit/shared";
import { AUDIT_STAGES } from "@/lib/site-audit/types";
import type { StageStatusMap, WebsiteAuditRun } from "@/lib/site-audit/types";

type CreateBody = { url?: string };

function initialStageStatus(): StageStatusMap {
  const map: StageStatusMap = {};
  for (const stage of AUDIT_STAGES) {
    map[stage] = { status: "pending" };
  }
  return map;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("website_audit_runs")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ runs: (data ?? []) as WebsiteAuditRun[] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = normalizeAuditUrl(body.url ?? "");
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("website_audit_runs")
    .insert({
      owner_user_id: user.id,
      input_url: url,
      normalized_url: url,
      status: "pending",
      current_stage: null,
      stage_status: initialStageStatus(),
      report_json: {},
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create audit run" },
      { status: 500 },
    );
  }
  return NextResponse.json({ run: data as WebsiteAuditRun });
}
