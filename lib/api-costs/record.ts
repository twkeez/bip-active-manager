import { createAdminClient } from "@/lib/supabase/admin";

// Paid API calls other than Claude (which lib/ai/usage.ts records) go in the
// same ai_usage table, so AI Spend shows one total. DataForSEO reports each
// call's price in its response; it was ignored until 2026-10-28.

/** Records one paid call. Never throws: a failed write is only logged. */
export async function recordApiCost(entry: { feature: string; model: string; costUsd: number }): Promise<void> {
  if (!(entry.costUsd > 0)) return;
  try {
    const { error } = await createAdminClient()
      .from("ai_usage")
      .insert({ feature: entry.feature, model: entry.model, cost_usd: Number(entry.costUsd.toFixed(6)) });
    if (error) console.error(`[api-cost] couldn't record ${entry.feature}: ${error.message}`);
  } catch (error) {
    console.error(`[api-cost] couldn't record ${entry.feature}:`, error);
  }
}

/** "backlinks/summary" from https://api.dataforseo.com/v3/backlinks/summary/live */
export function dataForSeoEndpointName(url: string): string {
  return url.replace(/^https:\/\/api\.dataforseo\.com\/v3\//, "").replace(/\/(live|task_post|task_get)(\/.*)?$/, "").replace(/\/advanced$/, "");
}

/** The cost DataForSEO reports for a request (top-level `cost`, in USD). */
export function dataForSeoCost(data: unknown): number {
  const cost = Number((data as { cost?: unknown } | null)?.cost ?? 0);
  return Number.isFinite(cost) ? cost : 0;
}
