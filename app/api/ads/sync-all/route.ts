import { NextResponse } from "next/server";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import { syncClientAds } from "@/lib/ads/sync-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SYNC_BATCH_SIZE = 4;

type SyncAllResult = {
  clientId: number;
  accountName: string;
  status: "ok" | "failed";
  error?: string;
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

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: clientsRaw, error: clientsError } = await admin
    .from("clients")
    .select("id, account_name, ads_customer_id")
    .order("account_name", { ascending: true });
  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }

  const clients = clientsRaw ?? [];
  const syncableClients = clients.filter((client) =>
    isSyncableAdsCustomerId(client.ads_customer_id),
  );
  const skipped = clients.length - syncableClients.length;

  const results = await runInBatches(
    syncableClients,
    SYNC_BATCH_SIZE,
    async (client): Promise<SyncAllResult> => {
      const adsCustomerId = client.ads_customer_id!.trim();
      try {
        await syncClientAds(admin, client.id, adsCustomerId);
        return {
          clientId: client.id,
          accountName: client.account_name,
          status: "ok",
        };
      } catch (error) {
        return {
          clientId: client.id,
          accountName: client.account_name,
          status: "failed",
          error: error instanceof Error ? error.message : "Ads sync failed",
        };
      }
    },
  );

  const synced = results.filter((result) => result.status === "ok").length;
  const failed = results.filter((result) => result.status === "failed").length;

  return NextResponse.json({
    synced,
    failed,
    skipped,
    results,
  });
}
