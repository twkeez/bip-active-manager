import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";

// AI spend from ai_usage (lib/ai/usage.ts), grouped for /ai-spend.

export type UsageRow = {
  created_at: string;
  feature: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  web_searches: number;
  cost_usd: number | string;
};

export type FeatureSpend = {
  feature: string;
  models: string[];
  calls: number;
  inputTokens: number;
  outputTokens: number;
  webSearches: number;
  cost: number;
};

export type SpendSummary = {
  monthStart: string;
  monthTotal: number;
  monthCalls: number;
  byFeature: FeatureSpend[];
  /** Last 14 days, oldest first, with $0 days included. */
  byDay: { day: string; cost: number }[];
  firstRecordedAt: string | null;
};

export function summarizeSpend(rows: UsageRow[], now: Date): SpendSummary {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const month = rows.filter((row) => row.created_at >= monthStart);
  const features = new Map<string, FeatureSpend>();
  for (const row of month) {
    const entry = features.get(row.feature) ?? {
      feature: row.feature,
      models: [],
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      webSearches: 0,
      cost: 0,
    };
    if (!entry.models.includes(row.model)) entry.models.push(row.model);
    entry.calls += 1;
    entry.inputTokens += row.input_tokens;
    entry.outputTokens += row.output_tokens;
    entry.webSearches += row.web_searches;
    entry.cost += Number(row.cost_usd);
    features.set(row.feature, entry);
  }
  const byFeature = [...features.values()].sort((a, b) => b.cost - a.cost);

  const byDay: { day: string; cost: number }[] = [];
  for (let back = 13; back >= 0; back -= 1) {
    const day = new Date(now.getTime() - back * 86_400_000).toISOString().slice(0, 10);
    byDay.push({
      day,
      cost: rows.filter((row) => row.created_at.slice(0, 10) === day).reduce((sum, row) => sum + Number(row.cost_usd), 0),
    });
  }

  return {
    monthStart,
    monthTotal: byFeature.reduce((sum, entry) => sum + entry.cost, 0),
    monthCalls: month.length,
    byFeature,
    byDay,
    firstRecordedAt: rows.length ? rows.map((row) => row.created_at).sort()[0] : null,
  };
}

export async function loadSpend(admin: SupabaseClient, now = new Date()): Promise<SpendSummary> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);
  const since = (monthStart < twoWeeksAgo ? monthStart : twoWeeksAgo).toISOString();
  const rows = await fetchAllRows<UsageRow>(
    (from, to) =>
      admin
        .from("ai_usage")
        .select("created_at,feature,model,input_tokens,output_tokens,web_searches,cost_usd")
        .gte("created_at", since)
        .order("id")
        .range(from, to),
    "ai_usage",
  );
  return summarizeSpend(rows, now);
}
