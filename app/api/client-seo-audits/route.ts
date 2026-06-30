import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuditUrl } from "@/lib/site-audit/shared";
import { AUDIT_STAGES } from "@/lib/site-audit/types";
import type { StageStatusMap, WebsiteAuditRun } from "@/lib/site-audit/types";
import { buildTemplateFromReport, type PackageTier } from "@/lib/site-audit/seo-audit-template";
import type { ClientSeoAudit } from "@/lib/site-audit/seo-audit-types";

function initialStageStatus(): StageStatusMap {
  const map: StageStatusMap = {};
  for (const stage of AUDIT_STAGES) map[stage] = { status: "pending" };
  return map;
}

type ClientRef = {
  id: number;
  account_name: string;
  website: string | null;
  marketing_strategist: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("client_seo_audits")
    .select("*, clients(account_name)")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const audits = (data ?? []).map((row) => {
    const { clients, ...audit } = row as ClientSeoAudit & { clients: { account_name: string } | null };
    return { ...audit, account_name: clients?.account_name ?? "Unknown client" };
  });
  return NextResponse.json({ audits });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { clientId?: number; packageTier?: PackageTier | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "A valid clientId is required" }, { status: 400 });
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, account_name, website, marketing_strategist")
    .eq("id", clientId)
    .maybeSingle<ClientRef>();
  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const url = normalizeAuditUrl(client.website ?? "");
  if (!url) {
    return NextResponse.json(
      { error: `${client.account_name} has no website on file. Add one to run an audit.` },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();

  // 1. The engine run that will gather raw data (driven stage-by-stage by the client).
  const { data: run, error: runError } = await supabase
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
    .single<WebsiteAuditRun>();
  if (runError || !run) {
    return NextResponse.json({ error: runError?.message ?? "Failed to create audit run" }, { status: 500 });
  }

  // 2. The client-facing audit instance, seeded with an empty (but scaffolded) template.
  const auditDate = nowIso.slice(0, 10);
  const template = buildTemplateFromReport(
    {},
    {
      client: client.account_name,
      website: url,
      auditDate,
      preparedBy: user.email ?? "",
      packageTier: body.packageTier ?? null,
    },
  );

  const { data: audit, error: auditError } = await supabase
    .from("client_seo_audits")
    .insert({
      owner_user_id: user.id,
      client_id: client.id,
      audit_run_id: run.id,
      status: "in_progress",
      audit_date: auditDate,
      prepared_by: user.email ?? null,
      package_tier: body.packageTier ?? null,
      template_json: template,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single<ClientSeoAudit>();
  if (auditError || !audit) {
    return NextResponse.json({ error: auditError?.message ?? "Failed to create audit" }, { status: 500 });
  }

  return NextResponse.json({ audit: { ...audit, account_name: client.account_name }, run });
}
