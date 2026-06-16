import type { SupabaseClient } from "@supabase/supabase-js";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import {
  buildConversionIntegrityAnomalies,
  summarizeConversionIntegrity,
  type ConversionIntegrityAnomaly,
  type ConversionIntegritySummary,
} from "@/lib/ads/conversion-integrity";
import { fetchLatestSnapshotsByClient } from "@/lib/dashboard/snapshot-queries";
import type { AdsSnapshot, ClientRow } from "@/lib/types/client";

export type ConversionIntegrityInitialData = {
  anomalies: ConversionIntegrityAnomaly[];
  summary: ConversionIntegritySummary;
  lastAdsSyncAt: string | null;
  loadError: string | null;
};

export async function loadConversionIntegrityData(
  supabase: SupabaseClient,
): Promise<ConversionIntegrityInitialData> {
  const [{ data: clientsRaw, error: clientsError }, adsSnapshots] = await Promise.all([
    supabase
      .from("clients")
      .select("id, account_name, ads_customer_id, website")
      .order("account_name", { ascending: true }),
    fetchLatestSnapshotsByClient<AdsSnapshot>(supabase, "client_ads_snapshots", "*"),
  ]);

  if (clientsError) {
    return {
      anomalies: [],
      summary: summarizeConversionIntegrity([], { campaignsScanned: 0, accountsScanned: 0 }),
      lastAdsSyncAt: null,
      loadError: clientsError.message,
    };
  }

  const clients = (clientsRaw ?? []) as Pick<
    ClientRow,
    "id" | "account_name" | "ads_customer_id" | "website"
  >[];
  const syncableClients = clients.filter((client) => isSyncableAdsCustomerId(client.ads_customer_id));
  const completedSnapshots = adsSnapshots.filter((snapshot) => snapshot.run_status === "completed");
  const syncableClientIds = new Set(syncableClients.map((client) => client.id));
  const scannedSnapshots = completedSnapshots.filter((snapshot) =>
    syncableClientIds.has(snapshot.client_id),
  );

  let campaignsScanned = 0;
  for (const snapshot of scannedSnapshots) {
    campaignsScanned += (snapshot.campaigns ?? []).length;
  }

  const anomalies = buildConversionIntegrityAnomalies({
    clients: syncableClients,
    snapshots: scannedSnapshots,
  });

  const summary = summarizeConversionIntegrity(anomalies, {
    campaignsScanned,
    accountsScanned: scannedSnapshots.length,
  });

  const lastAdsSyncAt =
    adsSnapshots.length > 0
      ? adsSnapshots.reduce<string | null>((latest, row) => {
          if (!latest || row.updated_at > latest) return row.updated_at;
          return latest;
        }, null)
      : null;

  return {
    anomalies,
    summary,
    lastAdsSyncAt,
    loadError: null,
  };
}
