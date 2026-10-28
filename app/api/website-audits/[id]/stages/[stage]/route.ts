import { NextResponse } from "next/server";
import { checkAiVisibility } from "@/lib/website-audit/ai-visibility";
import { checkAuthority } from "@/lib/website-audit/authority";
import { analyzeContent } from "@/lib/website-audit/content";
import { computeScore } from "@/lib/website-audit/score";
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
    let aiCost = Number(audit.ai_cost_usd ?? 0);
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
    } else if ((stage as AuditStage) === "ai-visibility") {
      // An unfinished run is picked up where it stopped (only unanswered
      // prompts are asked); a finished one starts again from scratch.
      const resume = results.aiVisibility && !results.aiVisibility.complete ? results.aiVisibility : undefined;
      results.aiVisibility = await checkAiVisibility(
        { domain: audit.domain, practiceName: audit.practice_name, city: audit.city, state: audit.state },
        results.technical,
        resume,
        { budgetMs: 230_000 },
      );
      dataForSeoCost += results.aiVisibility.costUsd - (resume?.costUsd ?? 0);
    } else if ((stage as AuditStage) === "content") {
      results.content = await analyzeContent(
        { practiceName: audit.practice_name, city: audit.city, state: audit.state, domain: audit.domain },
        results,
      );
      aiCost += results.content.costUsd;
    }
    // The score is plain arithmetic over the other sections: refresh it after any step once content exists.
    if (results.content) results.score = computeScore(results);
    await setStage({
      results,
      dataforseo_cost_usd: Number(dataForSeoCost.toFixed(4)),
      ai_cost_usd: Number(aiCost.toFixed(4)),
      score: results.score?.total ?? null,
      stage_status: { ...audit.stage_status, [stage]: { status: "done", at: now() } },
    });
    return NextResponse.json({ ok: true });
  } catch (stageError) {
    const message = stageError instanceof Error ? stageError.message : "The step failed.";
    await setStage({ stage_status: { ...audit.stage_status, [stage]: { status: "failed", at: now(), error: message } } }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
