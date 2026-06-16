import { runSalesLighthouseAudit } from "@/lib/sales/lighthouse";
import type { LighthouseStageResult } from "@/lib/site-audit/types";

export async function runLighthouseStage(url: string): Promise<LighthouseStageResult> {
  const result = await runSalesLighthouseAudit(url);
  return {
    url: result.url,
    fetchedAt: result.fetchedAt,
    scores: result.scores,
    metrics: result.metrics,
    findings: result.findings.map((finding) => ({
      id: finding.id,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      display_value: finding.display_value,
    })),
  };
}
