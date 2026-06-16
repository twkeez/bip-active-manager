import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditReportJson,
  AuditRunStatus,
  AuditStage,
  StageStatusMap,
  WebsiteAuditRun,
} from "@/lib/site-audit/types";
import { AUDIT_STAGES } from "@/lib/site-audit/types";
import { runDiscoveryStage } from "@/lib/site-audit/stages/discovery";
import { runSitemapStage } from "@/lib/site-audit/stages/sitemap";
import { runCrawlStage } from "@/lib/site-audit/stages/crawl";
import { runSchemaStage } from "@/lib/site-audit/stages/schema";
import { runTechnicalSeoStage } from "@/lib/site-audit/stages/technical-seo";
import { runLighthouseStage } from "@/lib/site-audit/stages/lighthouse";
import { runKeywordsStage } from "@/lib/site-audit/stages/keywords";
import { runSummaryStage } from "@/lib/site-audit/stages/summary";

export async function getOwnedAuditRun(
  supabase: SupabaseClient,
  userId: string,
  runId: number,
) {
  const { data, error } = await supabase
    .from("website_audit_runs")
    .select("*")
    .eq("id", runId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as WebsiteAuditRun | null) ?? null;
}

function computeRunStatus(stageStatus: StageStatusMap): AuditRunStatus {
  const statuses = AUDIT_STAGES.map((stage) => stageStatus[stage]?.status ?? "pending");
  if (statuses.every((status) => status === "done")) return "completed";
  if (statuses.some((status) => status === "failed")) {
    if (statuses.some((status) => status === "done")) return "partial";
    return "failed";
  }
  if (statuses.some((status) => status === "running")) return "running";
  if (statuses.some((status) => status === "done")) return "partial";
  return "pending";
}

async function persistRun(
  supabase: SupabaseClient,
  runId: number,
  userId: string,
  patch: {
    status?: AuditRunStatus;
    current_stage?: string | null;
    stage_status?: StageStatusMap;
    report_json?: AuditReportJson;
    normalized_url?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("website_audit_runs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("owner_user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as WebsiteAuditRun;
}

export async function executeAuditStage(
  supabase: SupabaseClient,
  userId: string,
  run: WebsiteAuditRun,
  stage: AuditStage,
): Promise<WebsiteAuditRun> {
  const stageStatus: StageStatusMap = { ...(run.stage_status ?? {}) };
  stageStatus[stage] = {
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  };

  let report: AuditReportJson = { ...(run.report_json ?? {}) };
  run = await persistRun(supabase, run.id, userId, {
    status: "running",
    current_stage: stage,
    stage_status: stageStatus,
    report_json: report,
  });

  try {
    const url = run.normalized_url ?? run.input_url;
    switch (stage) {
      case "discovery": {
        const discovery = await runDiscoveryStage(run.input_url);
        report.discovery = discovery;
        await persistRun(supabase, run.id, userId, {
          normalized_url: discovery.normalizedUrl,
        });
        break;
      }
      case "sitemap": {
        if (!report.discovery) throw new Error("Discovery stage must run first.");
        report.sitemap = await runSitemapStage(report.discovery);
        break;
      }
      case "crawl": {
        const start = report.discovery?.finalUrl ?? url;
        report.crawl = await runCrawlStage(start);
        break;
      }
      case "schema": {
        if (!report.crawl) throw new Error("Crawl stage must run first.");
        report.schema = runSchemaStage(report.crawl);
        break;
      }
      case "technical_seo": {
        if (!report.discovery || !report.crawl) {
          throw new Error("Discovery and crawl stages must run first.");
        }
        report.technical_seo = await runTechnicalSeoStage(report.discovery, report.crawl);
        break;
      }
      case "lighthouse": {
        const target = report.discovery?.finalUrl ?? url;
        report.lighthouse = await runLighthouseStage(target);
        break;
      }
      case "keywords": {
        if (!report.crawl) throw new Error("Crawl stage must run first.");
        const target = report.discovery?.finalUrl ?? url;
        report.keywords = await runKeywordsStage(target, report.crawl);
        break;
      }
      case "summary": {
        report.summary = await runSummaryStage(report);
        break;
      }
      default: {
        const _exhaustive: never = stage;
        throw new Error(`Unknown stage: ${String(_exhaustive)}`);
      }
    }

    stageStatus[stage] = {
      status: "done",
      startedAt: stageStatus[stage]?.startedAt ?? new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      error: null,
    };
    return persistRun(supabase, run.id, userId, {
      status: computeRunStatus(stageStatus),
      current_stage: stage,
      stage_status: stageStatus,
      report_json: report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stage failed";
    stageStatus[stage] = {
      status: "failed",
      startedAt: stageStatus[stage]?.startedAt ?? new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      error: message,
    };
    return persistRun(supabase, run.id, userId, {
      status: computeRunStatus(stageStatus),
      current_stage: stage,
      stage_status: stageStatus,
      report_json: report,
    });
  }
}

export async function executeAllAuditStages(
  supabase: SupabaseClient,
  userId: string,
  run: WebsiteAuditRun,
) {
  let current = run;
  for (const stage of AUDIT_STAGES) {
    const status = current.stage_status?.[stage]?.status;
    if (status === "done") continue;
    current = await executeAuditStage(supabase, userId, current, stage);
    if (current.stage_status?.[stage]?.status === "failed") break;
  }
  return current;
}
