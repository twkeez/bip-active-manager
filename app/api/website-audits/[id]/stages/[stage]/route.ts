import { NextResponse } from "next/server";
import { checkAuthority } from "@/lib/website-audit/authority";
import { crawlSite } from "@/lib/website-audit/crawl";
import { requireAuditAdmin } from "@/lib/website-audit/access";
import { AUDIT_STAGES, type AuditStage, type WebsiteAuditRow } from "@/lib/website-audit/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

/** Runs one step of an audit and saves its section of the results. */
export async function POST(_request: Request, context: { params: Promise<{ id: string; stage: string }> }) {
  const auth = await requireAuditAdmin();
  if ("error" in auth) return auth.error;
  const { id: rawId, stage } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || !(AUDIT_STAGES as readonly string[]).includes(stage)) {
    return NextResponse.json({ error: "Unknown audit or step" }, { status: 404 });
  }
  const admin = createAdminClient();
  const { data: row, error } = await admin.from("website_audits").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  const audit = row as WebsiteAuditRow;

  const setStage = async (patch: Partial<WebsiteAuditRow>) => {
    const { error: saveError } = await admin.from("website_audits").update(patch).eq("id", id);
    if (saveError) throw new Error(`Couldn't save the audit: ${saveError.message}`);
  };
  const now = () => new Date().toISOString();
  await setStage({ stage_status: { ...audit.stage_status, [stage]: { status: "running", at: now() } } });

  try {
    const results = { ...audit.results };
    let dataForSeoCost = Number(audit.dataforseo_cost_usd ?? 0);
    if ((stage as AuditStage) === "crawl") {
      // Leave a minute for saving: the route's limit is 300 seconds.
      results.technical = await crawlSite(audit.domain, 230_000);
    } else if ((stage as AuditStage) === "authority") {
      let knownPlaceId: string | null = null;
      if (audit.client_id) {
        const { data: client } = await admin.from("clients").select("google_place_id").eq("id", audit.client_id).maybeSingle();
        knownPlaceId = (client?.google_place_id as string | null | undefined)?.trim() || null;
      }
      results.authority = await checkAuthority({
        domain: audit.domain,
        practiceName: audit.practice_name,
        city: audit.city,
        state: audit.state,
        competitors: audit.competitors,
        knownPlaceId,
      });
      dataForSeoCost += results.authority.costUsd;
    }
    await setStage({
      results,
      dataforseo_cost_usd: Number(dataForSeoCost.toFixed(4)),
      stage_status: { ...audit.stage_status, [stage]: { status: "done", at: now() } },
    });
    return NextResponse.json({ ok: true });
  } catch (stageError) {
    const message = stageError instanceof Error ? stageError.message : "The step failed.";
    await setStage({ stage_status: { ...audit.stage_status, [stage]: { status: "failed", at: now(), error: message } } }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
