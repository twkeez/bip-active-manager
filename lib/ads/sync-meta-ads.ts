import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMetaAdsInsights } from "@/lib/social/meta";
import { isoDaysAgo } from "@/lib/time";
import type { MetaAdsSnapshot } from "@/lib/types/client";

function isoDate(value: string) {
  return value.slice(0, 10);
}

// Fetch a rolling 30-day Meta ads snapshot and store it, mirroring syncClientAds
// for Google Ads. The caller resolves the ad account + durable token first.
export async function syncClientMetaAds(
  admin: SupabaseClient,
  clientId: number,
  adAccountId: string,
  adAccountName: string | null,
  accessToken: string,
): Promise<MetaAdsSnapshot> {
  const startDate = isoDate(isoDaysAgo(30));
  const endDate = isoDate(new Date().toISOString());
  const { data: created, error: createError } = await admin
    .from("client_meta_ads_snapshots")
    .insert({
      client_id: clientId,
      ad_account_id: adAccountId,
      ad_account_name: adAccountName,
      start_date: startDate,
      end_date: endDate,
      run_status: "running",
      totals: {},
      campaigns: [],
    })
    .select("*")
    .single<MetaAdsSnapshot>();
  if (createError || !created) {
    throw new Error(createError?.message ?? "Failed to create Meta ads snapshot.");
  }

  try {
    const data = await fetchMetaAdsInsights(adAccountId, accessToken);
    const { error: updateError } = await admin
      .from("client_meta_ads_snapshots")
      .update({
        run_status: "completed",
        error_message: null,
        totals: data.totals,
        campaigns: data.campaigns,
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id);
    if (updateError) throw new Error(updateError.message);

    const { data: finalRow, error: reloadError } = await admin
      .from("client_meta_ads_snapshots")
      .select("*")
      .eq("id", created.id)
      .single<MetaAdsSnapshot>();
    if (reloadError || !finalRow) {
      throw new Error(reloadError?.message ?? "Failed to load Meta ads snapshot.");
    }
    return finalRow;
  } catch (error) {
    await admin
      .from("client_meta_ads_snapshots")
      .update({
        run_status: "failed",
        error_message: error instanceof Error ? error.message : "Meta ads sync failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id);
    throw error;
  }
}
