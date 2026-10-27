import { formatCostMicros } from "@/lib/ads/quality-score";
import type { AdsAuditReport } from "@/lib/types/client";

// The audit's Markdown export. Kept apart from audit-narrative.ts (which calls
// Claude) so the browser-side audit page can import it without pulling in
// server-only code.

function formatPercent(value: number | null) {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

export function buildAuditMarkdownExport(
  report: AdsAuditReport,
  narrativeMarkdown: string | null,
) {
  const lines: string[] = [
    `# Google Ads Performance Audit – ${report.account_name}`,
    "",
    `Date range: ${report.date_range.start} to ${report.date_range.end}`,
    `Generated: ${report.generated_at}`,
    "",
  ];

  if (narrativeMarkdown) {
    lines.push(narrativeMarkdown, "");
  }

  lines.push("## Structured data summary", "");
  const snap = report.executive_snapshot;
  lines.push(
    `- Spend: ${formatCostMicros(snap.spend_micros)}`,
    `- Clicks: ${snap.clicks}`,
    `- CTR: ${formatPercent(snap.ctr)}`,
    `- Conversions: ${snap.conversions}`,
    `- Conversion rate: ${formatPercent(snap.conversion_rate)}`,
    `- CPA: ${snap.cost_per_conversion_micros ? formatCostMicros(snap.cost_per_conversion_micros) : "N/A"}`,
    "",
  );

  if (report.priorities.length) {
    lines.push("## Priorities", "");
    for (const item of report.priorities) {
      lines.push(`${item.rank}. **${item.title}** — ${item.rationale}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
