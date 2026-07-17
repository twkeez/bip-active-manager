import type { SupabaseClient } from "@supabase/supabase-js";
import { runGoogleAdsSync } from "@/lib/ads/google-ads";
import { buildAdsSignals } from "@/lib/ads/signals";
import { isoDaysAgo } from "@/lib/time";
import type { AdsCampaignMetric, AdsSignal, AdsSnapshot } from "@/lib/types/client";

function isoDate(value: string) {
  return value.slice(0, 10);
}

export type SyncClientAdsResult = {
  snapshot: AdsSnapshot;
  signals: AdsSignal[];
};

export async function syncClientAds(
  admin: SupabaseClient,
  clientId: number,
  adsCustomerId: string,
): Promise<SyncClientAdsResult> {
  const startDate = isoDate(isoDaysAgo(30));
  const endDate = isoDate(new Date().toISOString());
  const { data: createdSnapshot, error: createSnapshotError } = await admin
    .from("client_ads_snapshots")
    .insert({
      client_id: clientId,
      customer_id: adsCustomerId,
      start_date: startDate,
      end_date: endDate,
      run_status: "running",
      totals: {},
      campaigns: [],
      calls: [],
    })
    .select("*")
    .single<AdsSnapshot>();
  if (createSnapshotError || !createdSnapshot) {
    throw new Error(createSnapshotError?.message ?? "Failed to create ads snapshot.");
  }

  try {
    const sync = await runGoogleAdsSync(adsCustomerId, startDate, endDate);
    const campaigns = sync.campaigns.slice(0, 20);
    const { error: updateError } = await admin
      .from("client_ads_snapshots")
      .update({
        run_status: "completed",
        error_message: null,
        totals: sync.totals,
        campaigns,
        auction_insights: sync.auctionInsights,
        keyword_quality: sync.keywordQuality,
        calls: sync.calls,
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id);
    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: clearSignalsError } = await admin
      .from("client_ads_signals")
      .delete()
      .eq("client_id", clientId);
    if (clearSignalsError) {
      throw new Error(clearSignalsError.message);
    }

    const signalDrafts = buildAdsSignals(
      sync.totals,
      campaigns as AdsCampaignMetric[],
      sync.keywordQuality,
    );
    if (signalDrafts.length > 0) {
      const { error: insertSignalsError } = await admin.from("client_ads_signals").insert(
        signalDrafts.map((signal) => ({
          client_id: clientId,
          snapshot_id: createdSnapshot.id,
          ...signal,
        })),
      );
      if (insertSignalsError) {
        throw new Error(insertSignalsError.message);
      }
    }

    const [snapshotResult, signalsResult] = await Promise.all([
      admin
        .from("client_ads_snapshots")
        .select("*")
        .eq("id", createdSnapshot.id)
        .single<AdsSnapshot>(),
      admin
        .from("client_ads_signals")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .returns<AdsSignal[]>(),
    ]);
    if (snapshotResult.error || !snapshotResult.data) {
      throw new Error(snapshotResult.error?.message ?? "Failed to load ads snapshot.");
    }
    if (signalsResult.error) {
      throw new Error(signalsResult.error.message);
    }

    return {
      snapshot: snapshotResult.data,
      signals: signalsResult.data ?? [],
    };
  } catch (error) {
    await admin
      .from("client_ads_snapshots")
      .update({
        run_status: "failed",
        error_message: error instanceof Error ? error.message : "Ads sync failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id);
    throw error;
  }
}
