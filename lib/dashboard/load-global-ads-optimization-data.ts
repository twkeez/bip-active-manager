import type { SupabaseClient } from "@supabase/supabase-js";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import {
  buildGlobalAdsIssues,
  summarizeGlobalAdsIssues,
  type GlobalAdsIssue,
  type GlobalAdsOptimizationSummary,
} from "@/lib/ads/global-optimization";
import { fetchLatestSnapshotsByClient } from "@/lib/dashboard/snapshot-queries";
import type { AdsSnapshot, ClientRow } from "@/lib/types/client";

export type GlobalAdsCoverageStats = {
  totalClients: number;
  syncableAccountCount: number;
  syncedAccountCount: number;
  syncFailedAccountCount: number;
  healthySyncedAccountCount: number;
};

export type GlobalAdsOptimizationInitialData = {
  issues: GlobalAdsIssue[];
  summary: GlobalAdsOptimizationSummary;
  coverage: GlobalAdsCoverageStats;
  lastAdsSyncAt: string | null;
  loadError: string | null;
};

export async function loadGlobalAdsOptimizationData(
  supabase: SupabaseClient,
): Promise<GlobalAdsOptimizationInitialData> {
  const [{ data: clientsRaw, error: clientsError }, adsSnapshots] = await Promise.all([
    supabase
      .from("clients")
      .select("id, account_name, ads_customer_id")
      .order("account_name", { ascending: true }),
    fetchLatestSnapshotsByClient<AdsSnapshot>(supabase, "client_ads_snapshots", "*"),
  ]);

  if (clientsError) {
    return {
      issues: [],
      summary: summarizeGlobalAdsIssues([]),
      coverage: {
        totalClients: 0,
        syncableAccountCount: 0,
        syncedAccountCount: 0,
        syncFailedAccountCount: 0,
        healthySyncedAccountCount: 0,
      },
      lastAdsSyncAt: null,
      loadError: clientsError.message,
    };
  }

  const clients = (clientsRaw ?? []) as Pick<ClientRow, "id" | "account_name" | "ads_customer_id">[];
  const syncableClients = clients.filter((client) => isSyncableAdsCustomerId(client.ads_customer_id));
  const snapshotByClientId = new Map(adsSnapshots.map((snapshot) => [snapshot.client_id, snapshot]));

  const issues = buildGlobalAdsIssues({ clients: syncableClients, snapshots: adsSnapshots });
  const summary = summarizeGlobalAdsIssues(issues);
  summary.connectedAccountCount = syncableClients.length;

  const issueClientIds = new Set(issues.map((issue) => issue.clientId));
  let syncedAccountCount = 0;
  let syncFailedAccountCount = 0;
  let healthySyncedAccountCount = 0;

  for (const client of syncableClients) {
    const snapshot = snapshotByClientId.get(client.id);
    if (!snapshot) continue;
    syncedAccountCount += 1;
    if (snapshot.run_status === "failed") {
      syncFailedAccountCount += 1;
      continue;
    }
    if (snapshot.run_status === "completed" && !issueClientIds.has(client.id)) {
      healthySyncedAccountCount += 1;
    }
  }

  const coverage: GlobalAdsCoverageStats = {
    totalClients: clients.length,
    syncableAccountCount: syncableClients.length,
    syncedAccountCount,
    syncFailedAccountCount,
    healthySyncedAccountCount,
  };

  const lastAdsSyncAt =
    adsSnapshots.length > 0
      ? adsSnapshots.reduce<string | null>((latest, row) => {
          if (!latest || row.updated_at > latest) return row.updated_at;
          return latest;
        }, null)
      : null;

  return {
    issues,
    summary,
    coverage,
    lastAdsSyncAt,
    loadError: null,
  };
}
