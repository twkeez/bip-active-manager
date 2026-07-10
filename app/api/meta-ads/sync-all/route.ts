import { NextResponse } from "next/server";
import { syncClientMetaAds } from "@/lib/ads/sync-meta-ads";
import { getMetaAccessTokenForSync } from "@/lib/social/token-manager";
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

// Refresh every already-mapped client. Unmapped clients are skipped — map them
// once via the per-client "Sync Meta Ads" button (which auto-matches by name and
// back-fills meta_ad_account_id), then they flow through here.
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
    .select("id, account_name, meta_ad_account_id")
    .order("account_name", { ascending: true });
  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }

  const clients = clientsRaw ?? [];
  const mapped = clients.filter(
    (client) => (client.meta_ad_account_id ?? "").replace(/[^0-9]/g, "").length > 0,
  );
  const skipped = clients.length - mapped.length;

  let accessToken: string;
  try {
    const tokenState = await getMetaAccessTokenForSync(admin);
    accessToken = tokenState.accessToken;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta token unavailable" },
      { status: 500 },
    );
  }

  const results = await runInBatches(
    mapped,
    SYNC_BATCH_SIZE,
    async (client): Promise<SyncAllResult> => {
      const digits = client.meta_ad_account_id!.replace(/[^0-9]/g, "");
      try {
        await syncClientMetaAds(admin, client.id, `act_${digits}`, client.account_name, accessToken);
        return { clientId: client.id, accountName: client.account_name, status: "ok" };
      } catch (error) {
        return {
          clientId: client.id,
          accountName: client.account_name,
          status: "failed",
          error: error instanceof Error ? error.message : "Meta ads sync failed",
        };
      }
    },
  );

  const synced = results.filter((result) => result.status === "ok").length;
  const failed = results.filter((result) => result.status === "failed").length;

  return NextResponse.json({ synced, failed, skipped, results });
}
