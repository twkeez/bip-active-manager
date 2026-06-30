import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseAuditRunId } from "@/lib/site-audit/shared";
import { getOwnedAuditRun } from "@/lib/site-audit/orchestrator";
import { buildTemplateFromReport, type PackageTier } from "@/lib/site-audit/seo-audit-template";
import { draftNarrativeSections } from "@/lib/site-audit/seo-audit-ai";
import type { ClientSeoAudit } from "@/lib/site-audit/seo-audit-types";

/**
 * Builds the draft template from the engine run's results: maps report_json onto
 * the rated sections, then AI-drafts the prose sections. Run after the audit
 * pipeline stages have completed.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await context.params;
  const id = parseAuditRunId(idRaw);
  if (!id) return NextResponse.json({ error: "Invalid audit id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: audit, error } = await supabase
    .from("client_seo_audits")
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .maybeSingle<ClientSeoAudit>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!audit) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  if (!audit.audit_run_id) {
    return NextResponse.json({ error: "Audit has no linked engine run." }, { status: 400 });
  }

  const run = await getOwnedAuditRun(supabase, user.id, audit.audit_run_id);
  if (!run) return NextResponse.json({ error: "Engine run not found" }, { status: 404 });

  const report = run.report_json ?? {};
  // Preserve any manual edits the strategist already made to meta fields.
  const existingMeta = audit.template_json?.meta;
  const template = buildTemplateFromReport(report, {
    client: existingMeta?.client || "",
    website: existingMeta?.website || run.normalized_url || run.input_url,
    auditDate: existingMeta?.auditDate || audit.audit_date,
    preparedBy: existingMeta?.preparedBy || audit.prepared_by || user.email || "",
    packageTier: (existingMeta?.packageTier ?? (audit.package_tier as PackageTier | null)) ?? null,
  });

  const narrative = await draftNarrativeSections(template, report);
  template.executiveSummary = narrative.executiveSummary;
  template.topPriorities = narrative.topPriorities;
  template.contentOpportunities = narrative.contentOpportunities;
  template.recommendations = narrative.recommendations;

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("client_seo_audits")
    .update({ template_json: template, status: "draft", updated_at: now })
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .select("*")
    .single<ClientSeoAudit>();
  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Failed to build audit" }, { status: 500 });
  }

  return NextResponse.json({ audit: updated });
}
