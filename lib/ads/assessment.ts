import { generateClaudeContent } from "@/lib/ai/claude";
import type {
  AdsAssessment,
  AdsAuctionInsightRow,
  AdsAuditReport,
} from "@/lib/types/client";

function dollars(micros: number | null | undefined): number | null {
  if (micros == null) return null;
  return Math.round((micros / 1_000_000) * 100) / 100;
}

function pct(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

// The structured JSON schema Claude must return. Mirrors the AdsAssessment type.
const RESPONSE_SCHEMA = `{
  "summary": { "period": "string", "total_spend": float, "annualized_spend": float, "total_conversions": float, "avg_cost_per_conv": float|null, "impression_share": "string e.g. '23%' or '<10%'", "headline": "one sentence on the account's biggest issue" },
  "campaigns": [ { "name": "string", "spend": float, "conversions": float, "cost_per_conv": float|null, "impression_share_lost_rank_pct": float|null, "impression_share_lost_budget_pct": float|null, "health": "good|fair|poor" } ],
  "geographic": { "best_area": "string", "best_area_cost_per_conv": float|null, "areas": [ { "name": "string", "spend": float, "conversions": float, "cost_per_conv": float|null, "vs_best_area_multiplier": float|null, "recommendation": "keep|consider|remove" } ], "estimated_monthly_waste_from_poor_areas": float },
  "search_term_waste": { "irrelevant_categories": [ { "category": "string", "term_count": int, "estimated_spend": float, "example_terms": ["string"] } ], "total_estimated_waste": float },
  "keyword_flags": [ { "keyword": "string", "campaign": "string", "spend": float, "conversions": float, "cost_per_conv": float|null, "issue": "string", "action": "pause|switch_to_phrase|switch_to_exact|reduce_bid|monitor" } ],
  "ad_schedule": { "best_hours": [ { "hour": int, "cost_per_conv": float|null } ], "worst_hours": [ { "hour": int, "cost_per_conv": float|null, "spend": float } ], "best_days": ["string"], "worst_days": ["string"], "daypart_recommendation": "one sentence" },
  "competitive_position": { "our_impression_share": "string", "competitors": [ { "domain": "string", "impression_share": "string", "position_above_rate": "string" } ], "summary": "two sentences on competitive standing" },
  "service_gaps": [ { "service": "string", "issue": "string", "recommendation": "string" } ],
  "action_items": [ { "priority": "critical|high|medium|low", "title": "string", "explanation": "2-3 sentences", "estimated_monthly_impact": "string e.g. 'Saves ~$480/mo'", "category": "geography|keywords|negatives|placements|structure|bidding|creative" } ]
}`;

const SYSTEM_PROMPT = `You are an expert Google Ads consultant specializing in veterinary practices.
You analyze Google Ads performance data and return structured, prioritized recommendations.

Your analysis priorities, in order:
1. Geographic efficiency — is spend concentrated where the practice can serve patients?
2. Search term relevance — are broad-match keywords triggering irrelevant searches?
3. Impression share and competitive position — can the practice be found when people search?
4. Keyword-level waste — individual keywords spending budget with no return.
5. Ad schedule efficiency — hours/days that consistently underperform.
6. Service-specific gaps — are key services generating visibility?

Benchmarks to apply:
- A good cost per conversion for a vet practice is under $20; above $40 is a red flag.
- Impression share below 20% means the practice is largely invisible.
- Search terms matching rescue, shelter, adopt, spay, neuter, hotline, free vet, low cost,
  mobile vet, jobs/careers, or competitor brand names are irrelevant and wasteful.
- For geography: compare each area's cost/conv to the best-performing area. If an area costs
  2x or more than the best, flag it for removal.
- Keywords with 0 conversions and meaningful spend should be flagged individually.

Use ONLY the numbers provided — never invent metrics. If a section has no data, return an
empty array (or "N/A" for strings). Return a single valid JSON object matching the schema.
Output only the JSON object — no preamble, no markdown fences.

Keep it concise to stay within length limits: at most 8 action_items, 12 keyword_flags,
8 geographic areas, 6 search-term categories, and 5 service_gaps. Keep each explanation to
1-2 sentences. Do not use trailing commas.`;

function buildPayload(report: AdsAuditReport, auctionInsights: AdsAuctionInsightRow[]) {
  const snap = report.executive_snapshot;
  return {
    account: report.account_name,
    date_range: report.date_range,
    snapshot: {
      total_spend: dollars(snap.spend_micros),
      clicks: snap.clicks,
      impressions: snap.impressions,
      conversions: snap.conversions,
      ctr: pct(snap.ctr),
      conversion_rate: pct(snap.conversion_rate),
      avg_cpc: dollars(snap.average_cpc_micros),
      cost_per_conv: dollars(snap.cost_per_conversion_micros),
    },
    match_type_mix: {
      broad_spend_share: pct(report.match_type_mix.broad_spend_share),
      broad_dominant: report.match_type_mix.flag_broad_dominant,
    },
    campaigns: report.account_metadata.campaigns.map((c) => ({
      name: c.campaign_name,
      channel: c.advertising_channel_type,
      bidding: c.bidding_strategy_type,
      spend: dollars(c.cost_micros),
      conversions: c.conversions,
    })),
    top_keywords: report.top_keywords.slice(0, 15).map((k) => ({
      keyword: k.keyword,
      campaign: k.campaign_name,
      match_type: k.match_type,
      spend: dollars(k.cost_micros),
      conversions: k.conversions,
      cost_per_conv: dollars(k.cpa_micros),
    })),
    waste_keywords: report.waste_keywords.slice(0, 20).map((k) => ({
      keyword: k.keyword,
      campaign: k.campaign_name,
      match_type: k.match_type,
      spend: dollars(k.cost_micros),
      conversions: k.conversions,
      cost_per_conv: dollars(k.cpa_micros),
      notes: k.notes,
    })),
    quality_score: report.quality_score.summary,
    search_terms: {
      waste: report.search_terms.waste_terms.slice(0, 30).map((t) => ({
        term: t.search_term,
        spend: dollars(t.cost_micros),
        clicks: t.clicks,
        conversions: t.conversions,
      })),
      drift: report.search_terms.drift_terms.slice(0, 20).map((t) => ({
        term: t.search_term,
        spend: dollars(t.cost_micros),
      })),
      negative_candidates: report.search_terms.negative_candidates,
    },
    geography: report.geography.top_locations.slice(0, 20).map((g) => ({
      location_id: g.location_id,
      location_type: g.location_type,
      spend: dollars(g.cost_micros),
      clicks: g.clicks,
      conversions: g.conversions,
    })),
    schedule: {
      best_windows: report.schedule.best_windows.map((w) => ({
        day: w.day_of_week,
        hour: w.hour,
        cost_per_conv: dollars(w.cpa_micros),
      })),
      worst_windows: report.schedule.worst_windows.map((w) => ({
        day: w.day_of_week,
        hour: w.hour,
        spend: dollars(w.cost_micros),
        cost_per_conv: dollars(w.cpa_micros),
      })),
    },
    auction_insights: auctionInsights.slice(0, 12).map((a) => ({
      domain: a.domain,
      campaign: a.campaign_name,
      impression_share: pct(a.impression_share),
      overlap_rate: pct(a.overlap_rate),
      position_above_rate: pct(a.position_above_rate),
      outranking_share: pct(a.outranking_share),
    })),
    conversion_actions: report.account_metadata.conversion_actions,
    missing_data: report.missing_data,
    rule_based_priorities: report.priorities,
  };
}

function parseAssessment(raw: string): AdsAssessment {
  let text = raw.trim();
  // Strip markdown fences if the model added them.
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  // Fall back to the outermost JSON object if there's stray prose.
  if (!text.startsWith("{")) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) text = text.slice(first, last + 1);
  }
  try {
    return JSON.parse(text) as AdsAssessment;
  } catch {
    // LLMs occasionally emit trailing commas or // comments, which JSON.parse rejects.
    const repaired = text
      .replace(/\/\/[^\n\r]*/g, "") // line comments
      .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
      .replace(/,(\s*[}\]])/g, "$1"); // trailing commas before } or ]
    return JSON.parse(repaired) as AdsAssessment;
  }
}

export async function generateAdsAssessment(input: {
  accountName: string;
  report: AdsAuditReport;
  auctionInsights: AdsAuctionInsightRow[];
}): Promise<AdsAssessment> {
  const payload = buildPayload(input.report, input.auctionInsights);
  const prompt = `${SYSTEM_PROMPT}

Return a JSON object that exactly matches this schema:

${RESPONSE_SCHEMA}

---

## Account data
${JSON.stringify(payload, null, 2)}

---

Important: Return only the JSON object. No preamble, no explanation outside the JSON.`;

  const raw = await generateClaudeContent([{ text: prompt }], {
    maxOutputTokens: 8192,
    temperature: 0.3,
  });
  return parseAssessment(raw);
}
