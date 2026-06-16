import { runSalesSeoAudit } from "@/lib/sales/audit";
import type {
  CrawlStageResult,
  DiscoveryStageResult,
  TechnicalSeoStageResult,
} from "@/lib/site-audit/types";

export async function runTechnicalSeoStage(
  discovery: DiscoveryStageResult,
  crawl: CrawlStageResult,
): Promise<TechnicalSeoStageResult> {
  const homepageAudit = await runSalesSeoAudit(discovery.finalUrl);
  const critical = crawl.issues.filter((issue) => issue.severity === "critical").length;
  const watch = crawl.issues.filter((issue) => issue.severity === "watch").length;

  return {
    homepageIssues: homepageAudit.issues.map((issue) => ({
      id: issue.id,
      severity: issue.severity,
      title: issue.title,
      description: issue.description,
      recommendation: issue.recommendation,
    })),
    crawlIssueCount: { critical, watch },
  };
}
