import type { ClientReportModel, ReportChannelBlock, ReportPeriodMetric, ReportRecommendationItem } from "@/lib/reporting/types";
import { parseRecommendations, RECOMMENDATIONS_MAX } from "@/lib/reporting/month-summary";

/**
 * The prompt for the AI's first draft of a month's summary and next steps.
 *
 * Built on the server from the same report model the PDF and Word export use,
 * so the AI sees only numbers that are on the report. It is told to use no
 * other numbers, to report drops as plainly as gains, and to say when data is
 * missing. Whatever it writes is a draft for the strategist to review.
 */

function formatValue(metric: ReportPeriodMetric, value: number): string {
  const rounded = Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${metric.valuePrefix ?? ""}${rounded}${metric.valueSuffix ?? ""}`;
}

export function metricLine(metric: ReportPeriodMetric): string | null {
  if (metric.current == null) return null;
  const now = formatValue(metric, metric.current);
  if (metric.previous == null || metric.deltaPercent == null) return `${metric.label}: ${now} (no earlier period to compare)`;
  const before = formatValue(metric, metric.previous);
  const sign = metric.deltaPercent > 0 ? "+" : "";
  return `${metric.label}: ${now}, was ${before} (${sign}${metric.deltaPercent.toFixed(1)}%)`;
}

function channelSection(block: ReportChannelBlock, window: string | null): string {
  const heading = `${block.title}${window ? ` (${window})` : ""}`;
  if (!block.connected || block.status === "not_connected") return `${heading}: not connected for this client.`;
  const lines = block.metrics.map(metricLine).filter((line): line is string => line !== null);
  if (block.status === "no_data" || lines.length === 0) return `${heading}: connected, but no data for this period.`;
  return [heading + ":", ...lines.map((line) => `  - ${line}`)].join("\n");
}

export function buildSummaryPrompt(report: ClientReportModel): string {
  const { channels, dataWindows } = report;
  const sections = [
    channelSection(channels.searchConsole, dataWindows.search ?? null),
    channelSection(channels.ga4, dataWindows.ga4 ?? null),
    channelSection(channels.ads, dataWindows.ads ?? null),
  ].join("\n\n");
  const stale = report.staleSources.map((s) => s.label);
  const suggestions = report.recommendations.slice(0, 6).map((r) => `  - [${r.priority}] ${r.text}`);

  return `You are drafting a monthly marketing report summary for a client of Beyond Indigo Pets. A strategist will review and edit your draft before the client sees anything.

Client: ${report.client.account_name}
Reporting window: ${report.reportingWindowLabel}

THE REPORT'S NUMBERS (current period, the period before, and the change):
${sections}
${stale.length ? `\nThese sources had not synced recently, so their numbers may be out of date: ${stale.join(", ")}.\n` : ""}
RULE-BASED SUGGESTIONS FROM THE REPORT (use only the ones the numbers support):
${suggestions.length ? suggestions.join("\n") : "  (none)"}

Write two things.

1. "summary": 3 to 5 sentences in the first person plural ("we"), plain and direct, written for the client.
   - Use only numbers listed above, written exactly as given. Never estimate, round differently, or invent a figure, a cause or a comparison.
   - Give the most important changes, whether up or down. Report a drop as plainly as a gain; don't spin it.
   - If a channel is not connected or has no data, don't mention its numbers.
   - No greeting, no sign-off, no exclamation marks, no superlatives.

2. "recommendations": 2 to 4 next steps, each one sentence starting with a verb, each tied to a number or gap above, with a priority of "high", "medium" or "low".

Answer with only a JSON object, no other text:
{"summary": "...", "recommendations": [{"priority": "high", "text": "..."}]}`;
}

/** Reads the AI's answer. Throws with a plain reason when it isn't usable. */
export function parseSummaryAnswer(raw: string): { summary: string; recommendations: ReportRecommendationItem[] } {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The AI's answer had no summary in it. Try again.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("The AI's answer couldn't be read. Try again.");
  }
  const { summary, recommendations } = parsed as { summary?: unknown; recommendations?: unknown };
  if (typeof summary !== "string" || !summary.trim()) throw new Error("The AI's answer had no summary in it. Try again.");
  return { summary: summary.trim(), recommendations: parseRecommendations(recommendations).slice(0, RECOMMENDATIONS_MAX) };
}
