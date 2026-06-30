import { generateClaudeText } from "@/lib/ai/claude";
import type { AuditReportJson } from "@/lib/site-audit/types";
import type { RecommendationPriority, SeoAuditTemplateData } from "@/lib/site-audit/seo-audit-template";

export type NarrativeSections = {
  executiveSummary: string;
  topPriorities: string[];
  contentOpportunities: string;
  recommendations: Array<{ recommendation: string; priority: RecommendationPriority | null; owner: string }>;
};

const EMPTY: NarrativeSections = {
  executiveSummary: "",
  topPriorities: ["", "", ""],
  contentOpportunities: "",
  recommendations: [],
};

const VALID_PRIORITY = new Set(["high", "med", "low"]);

/** Compact, token-light digest of the automated findings for the AI prompt. */
function digestReport(data: SeoAuditTemplateData, report: AuditReportJson): string {
  const lines: string[] = [];
  for (const section of data.ratedSections) {
    const rated = section.items.filter((i) => i.rating);
    if (rated.length === 0) continue;
    lines.push(
      `${section.number} ${section.title}: ` +
        rated.map((i) => `${i.label} = ${i.rating}${i.notes ? ` (${i.notes})` : ""}`).join("; "),
    );
  }
  if (data.keywords.targetKeywords) lines.push(`Target keywords: ${data.keywords.targetKeywords}`);
  if (report.summary?.markdown) lines.push(`Engine summary: ${report.summary.markdown.slice(0, 800)}`);
  return lines.join("\n");
}

/**
 * Drafts the prose sections of the audit (executive summary, top-3 priorities,
 * content opportunities, recommendations) from the auto-filled findings.
 * Resilient: on any failure returns empty strings so the audit still saves and
 * the strategist can write them by hand.
 */
export async function draftNarrativeSections(
  data: SeoAuditTemplateData,
  report: AuditReportJson,
): Promise<NarrativeSections> {
  const digest = digestReport(data, report);
  if (!digest.trim()) return EMPTY;

  const prompt = `You are an SEO strategist at Beyond Indigo Pets, a veterinary digital-marketing agency, writing a client-facing SEO site audit for "${data.meta.client}" (${data.meta.website}).

Here are the automated findings (rating = good/needs_work/critical):
${digest}

Write the client-facing narrative. Return ONLY JSON, no prose, in this exact shape:
{
  "executiveSummary": "3-5 sentence plain-English overview of site health and the highest-impact opportunities. Jargon-free.",
  "topPriorities": ["priority 1", "priority 2", "priority 3"],
  "contentOpportunities": "2-4 sentences on content gaps, pages that should exist, or restructuring opportunities.",
  "recommendations": [{"recommendation": "specific action", "priority": "high"|"med"|"low", "owner": "Beyond Indigo" or "Client"}]
}

Keep it concrete and tied to the findings. 3-6 recommendations, ordered by priority.`;

  try {
    const raw = await generateClaudeText(prompt);
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return EMPTY;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

    const topPriorities = Array.isArray(parsed.topPriorities)
      ? parsed.topPriorities.map((p) => String(p)).slice(0, 3)
      : ["", "", ""];
    while (topPriorities.length < 3) topPriorities.push("");

    const recommendations: NarrativeSections["recommendations"] = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
          .map((entry) => (entry ?? {}) as Record<string, unknown>)
          .filter((r) => typeof r.recommendation === "string")
          .map((r) => {
            const priority = String(r.priority);
            return {
              recommendation: r.recommendation as string,
              priority: (VALID_PRIORITY.has(priority) ? priority : null) as RecommendationPriority | null,
              owner: typeof r.owner === "string" ? r.owner : "",
            };
          })
      : [];

    return {
      executiveSummary: typeof parsed.executiveSummary === "string" ? parsed.executiveSummary : "",
      topPriorities,
      contentOpportunities: typeof parsed.contentOpportunities === "string" ? parsed.contentOpportunities : "",
      recommendations,
    };
  } catch {
    return EMPTY;
  }
}
