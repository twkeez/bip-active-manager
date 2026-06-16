import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptySeoOpsContext,
  evaluateSeoOpsClient,
  isSeoOpsEligibleClient,
  type SeoOpsEvaluationContext,
} from "@/lib/seo/ops/evaluate";
import {
  listSeoOpsCompletionsForClient,
  listSeoOpsCompletionsForClients,
  listSeoOpsTemplates,
} from "@/lib/seo/ops/store";
import type { ClientRow, GscSignal, GscQueryMetric, GbpReviewRow } from "@/lib/types/client";

async function fetchLatestGscBundle(supabase: SupabaseClient, clientId: number) {
  const { data: snapshot } = await supabase
    .from("client_gsc_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!snapshot) {
    return { gscSnapshot: null, gscSignals: [] as GscSignal[], gscQueryMetrics: [] as GscQueryMetric[] };
  }
  const [signalsQuery, queryMetricsQuery] = await Promise.all([
    supabase
      .from("client_gsc_signals")
      .select("*")
      .eq("snapshot_id", snapshot.id),
    supabase
      .from("client_gsc_query_metrics")
      .select("*")
      .eq("snapshot_id", snapshot.id)
      .order("impressions", { ascending: false })
      .limit(250),
  ]);
  return {
    gscSnapshot: snapshot,
    gscSignals: (signalsQuery.data ?? []) as GscSignal[],
    gscQueryMetrics: (queryMetricsQuery.data ?? []) as GscQueryMetric[],
  };
}

async function buildContextForClient(
  supabase: SupabaseClient,
  clientId: number,
  prefetched?: Partial<SeoOpsEvaluationContext>,
): Promise<SeoOpsEvaluationContext> {
  const base = emptySeoOpsContext();
  const gscBundle =
    prefetched?.gscSnapshot !== undefined
      ? {
          gscSnapshot: prefetched.gscSnapshot ?? null,
          gscSignals: prefetched.gscSignals ?? [],
          gscQueryMetrics: prefetched.gscQueryMetrics ?? [],
        }
      : await fetchLatestGscBundle(supabase, clientId);

  const [crawlQuery, gbpReviewsQuery, keywordTargetsQuery] = await Promise.all([
    supabase
      .from("client_seo_crawl_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("client_gbp_reviews")
      .select("*")
      .eq("client_id", clientId)
      .order("review_time_unix", { ascending: false })
      .limit(50),
    supabase
      .from("client_keyword_targets")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true),
  ]);

  return {
    ...base,
    ...gscBundle,
    seoCrawlSnapshot: crawlQuery.data ?? null,
    gbpReviews: (gbpReviewsQuery.data ?? []) as GbpReviewRow[],
    keywordTargets: keywordTargetsQuery.data ?? [],
    keywordHealthRows: prefetched?.keywordHealthRows ?? [],
    keywordHealthRefreshedAt: prefetched?.keywordHealthRefreshedAt ?? null,
  };
}

export async function buildSeoOpsEvaluation(
  supabase: SupabaseClient,
  client: ClientRow,
  prefetched?: Partial<SeoOpsEvaluationContext>,
) {
  const templates = await listSeoOpsTemplates(supabase);
  const completions = await listSeoOpsCompletionsForClient(supabase, client.id);
  const ctx = await buildContextForClient(supabase, client.id, prefetched);
  return evaluateSeoOpsClient(client, templates, completions, ctx);
}

export async function buildSeoOpsEvaluations(
  supabase: SupabaseClient,
  clients: ClientRow[],
) {
  const seoClients = clients.filter(isSeoOpsEligibleClient);
  if (seoClients.length === 0) return [];

  const templates = await listSeoOpsTemplates(supabase);
  const clientIds = seoClients.map((client) => client.id);
  const completions = await listSeoOpsCompletionsForClients(supabase, clientIds);
  const completionsByClient = new Map<number, typeof completions>();
  for (const row of completions) {
    if (!completionsByClient.has(row.client_id)) {
      completionsByClient.set(row.client_id, []);
    }
    completionsByClient.get(row.client_id)!.push(row);
  }

  const evaluations = await Promise.all(
    seoClients.map(async (client) => {
      const ctx = await buildContextForClient(supabase, client.id);
      return evaluateSeoOpsClient(
        client,
        templates,
        completionsByClient.get(client.id) ?? [],
        ctx,
      );
    }),
  );

  evaluations.sort((left, right) => {
    if (left.urgencyScore !== right.urgencyScore) {
      return right.urgencyScore - left.urgencyScore;
    }
    return left.accountName.localeCompare(right.accountName);
  });

  return evaluations;
}
