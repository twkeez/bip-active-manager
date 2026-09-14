import type { SupabaseClient } from "@supabase/supabase-js";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import { syncClientAds } from "@/lib/ads/sync-client";

/**
 * Refreshing every client's Google Ads data in one pass.
 *
 * This was the body of the "Sync all" button until the schedule needed it too.
 * The button and the nightly job must do exactly the same thing: the whole
 * reason the schedule exists is that ads reporting sat frozen from July to
 * September because the button is the only thing that ever refreshed it, and a
 * schedule that ran some lesser version of the work would hide the same gap.
 *
 * Clients without a usable customer ID are skipped rather than failed — most
 * of the roster does not buy ads, and counting them as failures would make a
 * healthy run look broken.
 */

/** Google rate-limits per customer; four at a time finishes ~40 accounts well inside the timeout. */
export const SYNC_BATCH_SIZE = 4;

export type SyncAllResult = {
  clientId: number;
  accountName: string;
  status: "ok" | "failed";
  error?: string;
};

export type SyncAllSummary = {
  synced: number;
  failed: number;
  skipped: number;
  results: SyncAllResult[];
};

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function runAdsSyncAll(admin: SupabaseClient): Promise<SyncAllSummary> {
  const { data: clientsRaw, error: clientsError } = await admin
    .from("clients")
    .select("id, account_name, ads_customer_id")
    .order("account_name", { ascending: true });
  if (clientsError) {
    throw new Error(clientsError.message);
  }

  const clients = clientsRaw ?? [];
  const syncableClients = clients.filter((client) =>
    isSyncableAdsCustomerId(client.ads_customer_id),
  );

  const results = await runInBatches(
    syncableClients,
    SYNC_BATCH_SIZE,
    async (client): Promise<SyncAllResult> => {
      const adsCustomerId = client.ads_customer_id!.trim();
      try {
        await syncClientAds(admin, client.id, adsCustomerId);
        return { clientId: client.id, accountName: client.account_name, status: "ok" };
      } catch (error) {
        // One account's failure must not strand the rest: a revoked customer ID
        // is common and should cost that client's data, not everyone's.
        return {
          clientId: client.id,
          accountName: client.account_name,
          status: "failed",
          error: error instanceof Error ? error.message : "Ads sync failed",
        };
      }
    },
  );

  return {
    synced: results.filter((result) => result.status === "ok").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: clients.length - syncableClients.length,
    results,
  };
}
