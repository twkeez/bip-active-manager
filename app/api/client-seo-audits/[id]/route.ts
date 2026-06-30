import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseAuditRunId } from "@/lib/site-audit/shared";
import { computeNextDue, isCadence } from "@/lib/site-audit/seo-audit-schedule";
import type { SeoAuditTemplateData } from "@/lib/site-audit/seo-audit-template";
import type {
  ClientSeoAudit,
  ClientSeoAuditSchedule,
  ClientSeoAuditStatus,
} from "@/lib/site-audit/seo-audit-types";

const VALID_STATUS = new Set<ClientSeoAuditStatus>(["in_progress", "draft", "completed"]);

async function authed(idRaw: string) {
  const id = parseAuditRunId(idRaw);
  if (!id) return { error: NextResponse.json({ error: "Invalid audit id" }, { status: 400 }) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { id, supabase, user };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await authed(id);
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from("client_seo_audits")
    .select("*")
    .eq("id", ctx.id)
    .eq("owner_user_id", ctx.user.id)
    .maybeSingle<ClientSeoAudit>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  return NextResponse.json({ audit: data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await authed(id);
  if (ctx.error) return ctx.error;
  const { supabase, user } = ctx;

  let body: {
    templateJson?: SeoAuditTemplateData;
    status?: ClientSeoAuditStatus;
    preparedBy?: string;
    packageTier?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (body.templateJson !== undefined) patch.template_json = body.templateJson;
  if (typeof body.preparedBy === "string") patch.prepared_by = body.preparedBy;
  if (body.packageTier !== undefined) patch.package_tier = body.packageTier;
  if (body.status !== undefined) {
    if (!VALID_STATUS.has(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
    patch.completed_at = body.status === "completed" ? now : null;
  }

  const { data: audit, error } = await supabase
    .from("client_seo_audits")
    .update(patch)
    .eq("id", ctx.id)
    .eq("owner_user_id", user.id)
    .select("*")
    .single<ClientSeoAudit>();
  if (error || !audit) {
    return NextResponse.json({ error: error?.message ?? "Failed to update audit" }, { status: 500 });
  }

  // Completing an audit advances that client's cadence (if they're enrolled).
  if (body.status === "completed") {
    const { data: schedule } = await supabase
      .from("client_seo_audit_schedules")
      .select("*")
      .eq("client_id", audit.client_id)
      .eq("owner_user_id", user.id)
      .maybeSingle<ClientSeoAuditSchedule>();
    if (schedule && isCadence(schedule.cadence_months)) {
      await supabase
        .from("client_seo_audit_schedules")
        .update({
          last_completed_at: now,
          next_due_at: computeNextDue(now, schedule.cadence_months),
          updated_at: now,
        })
        .eq("id", schedule.id)
        .eq("owner_user_id", user.id);
    }
  }

  return NextResponse.json({ audit });
}
