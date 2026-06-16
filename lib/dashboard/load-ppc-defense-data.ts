import type { SupabaseClient } from "@supabase/supabase-js";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import {
  buildBudgetHogs,
  buildLpDeficits,
  summarizePpcDefense,
  type BudgetHogItem,
  type LpDeficitItem,
  type PpcDefenseSummary,
} from "@/lib/ads/ppc-defense";
import { fetchLatestSnapshotsByClient } from "@/lib/dashboard/snapshot-queries";
import type { AdsSnapshot, ClientRow } from "@/lib/types/client";

export type PpcDefenseInitialData = {
  lpDeficits: LpDeficitItem[];
  budgetHogs: BudgetHogItem[];
  summary: PpcDefenseSummary;
  lastAdsSyncAt: string | null;
  loadError: string | null;
};

export async function loadPpcDefenseData(
  supabase: SupabaseClient,
): Promise<PpcDefenseInitialData> {
  const [{ data: clientsRaw, error: clientsError }, adsSnapshots] = await Promise.all([
    supabase
      .from("clients")
      .select("id, account_name, ads_customer_id")
      .order("account_name", { ascending: true }),
    fetchLatestSnapshotsByClient<AdsSnapshot>(supabase, "client_ads_snapshots", "*"),
  ]);

  if (clientsError) {
    return {
      lpDeficits: [],
      budgetHogs: [],
      summary: summarizePpcDefense({
        lpDeficits: [],
        budgetHogs: [],
        accountsScanned: 0,
        keywordsScanned: 0,
      }),
      lastAdsSyncAt: null,
      loadError: clientsError.message,
    };
  }

  const clients = (clientsRaw ?? []) as Pick<ClientRow, "id" | "account_name" | "ads_customer_id">[];
  const syncableClients = clients.filter((client) => isSyncableAdsCustomerId(client.ads_customer_id));
  const syncableClientIds = new Set(syncableClients.map((client) => client.id));
  const scannedSnapshots = adsSnapshots.filter(
    (snapshot) =>
      snapshot.run_status === "completed" && syncableClientIds.has(snapshot.client_id),
  );

  let keywordsScanned = 0;
  for (const snapshot of scannedSnapshots) {
    keywordsScanned += (snapshot.keyword_quality ?? []).length;
  }

  const lpDeficits = buildLpDeficits({ clients: syncableClients, snapshots: scannedSnapshots });
  const budgetHogs = buildBudgetHogs({ clients: syncableClients, snapshots: scannedSnapshots });
  const summary = summarizePpcDefense({
    lpDeficits,
    budgetHogs,
    accountsScanned: scannedSnapshots.length,
    keywordsScanned,
  });

  const lastAdsSyncAt =
    adsSnapshots.length > 0
      ? adsSnapshots.reduce<string | null>((latest, row) => {
          if (!latest || row.updated_at > latest) return row.updated_at;
          return latest;
        }, null)
      : null;

  return {
    lpDeficits,
    budgetHogs,
    summary,
    lastAdsSyncAt,
    loadError: null,
  };
}
