import { generateClaudeContent } from "@/lib/ai/claude";
import { formatCostMicros } from "@/lib/ads/quality-score";
import type { AdsAuditReport } from "@/lib/types/client";

function formatPercent(value: number | null) {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function buildAuditPrompt(report: AdsAuditReport) {
  const snap = report.executive_snapshot;
  const payload = {
    account: report.account_name,
    dateRange: report.date_range,
    snapshot: {
      spend: formatCostMicros(snap.spend_micros),
      clicks: snap.clicks,
      ctr: formatPercent(snap.ctr),
      conversions: snap.conversions,
      conversionRate: formatPercent(snap.conversion_rate),
      cpc: snap.average_cpc_micros ? formatCostMicros(snap.average_cpc_micros) : "N/A",
      cpa: snap.cost_per_conversion_micros
        ? formatCostMicros(snap.cost_per_conversion_micros)
        : "N/A",
    },
    matchTypeMix: {
      broadSpendShare: `${Math.round(report.match_type_mix.broad_spend_share * 100)}%`,
      broadDominant: report.match_type_mix.flag_broad_dominant,
    },
    topKeywords: report.top_keywords.slice(0, 8).map((row) => ({
      keyword: row.keyword,
      cpa: row.cpa_micros ? formatCostMicros(row.cpa_micros) : "N/A",
      conversionRate: formatPercent(row.conversion_rate),
      matchType: row.match_type,
    })),
    wasteKeywords: report.waste_keywords.slice(0, 8).map((row) => ({
      keyword: row.keyword,
      spend: formatCostMicros(row.cost_micros),
      cpa: row.cpa_micros ? formatCostMicros(row.cpa_micros) : "N/A",
      notes: row.notes,
    })),
    qualityScore: report.quality_score.summary,
    lowQsKeywords: report.quality_score.low_quality_keywords.slice(0, 8).map((row) => ({
      keyword: row.keyword,
      qs: row.quality_score,
      spend: formatCostMicros(row.cost_micros),
    })),
    searchTermWaste: report.search_terms.waste_terms.slice(0, 8).map((row) => ({
      term: row.search_term,
      spend: formatCostMicros(row.cost_micros),
    })),
    negativeCandidates: report.search_terms.negative_candidates.slice(0, 15),
    devices: report.devices.rows.map((row) => ({
      device: row.device,
      spend: formatCostMicros(row.cost_micros),
      conversions: row.conversions,
    })),
    geoWaste: report.geography.waste_locations.slice(0, 5).map((row) => ({
      locationId: row.location_id,
      spend: formatCostMicros(row.cost_micros),
    })),
    scheduleBest: report.schedule.best_windows.slice(0, 3),
    scheduleWorst: report.schedule.worst_windows.slice(0, 3),
    bidding: report.account_metadata.campaigns.slice(0, 5).map((row) => ({
      campaign: row.campaign_name,
      bidding: row.bidding_strategy_type,
      channel: row.advertising_channel_type,
    })),
    conversionActions: report.account_metadata.conversion_actions.slice(0, 8),
    missingData: report.missing_data,
    priorities: report.priorities,
  };

  return `You are a senior Google Ads strategist for veterinary practices.

Write a thorough Google Ads Performance Audit in markdown for the account below.
Use ONLY the numbers provided in the JSON — do not invent metrics.
Tone: direct, actionable, like an internal agency audit.

Structure with these sections (use ## headings):
1. Executive Summary
2. Overall Account Snapshot (bullet list of provided metrics)
3. Most Important Findings
4. Highest Performing Keywords (table or bullets from topKeywords)
5. Keywords Likely Wasting Budget (from wasteKeywords)
6. Quality Score Problems
7. Search Term / Query Drift (if data present)
8. Match Type Strategy
9. Geographic & Schedule Notes (if data present)
10. Missing Data & Next Steps
11. Priority Recommendations (ordered list from priorities)

Account data JSON:
${JSON.stringify(payload, null, 2)}`;
}

export async function generateAdsAuditNarrative(report: AdsAuditReport) {
  const prompt = buildAuditPrompt(report);
  const text = await generateClaudeContent([{ text: prompt }], {
    maxOutputTokens: 4096,
    temperature: 0.35,
  });
  return text.trim();
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
