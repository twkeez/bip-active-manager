import type { SupabaseClient } from "@supabase/supabase-js";
import { runGa4Sync } from "@/lib/ga4/google-analytics";
import { buildGa4Signals } from "@/lib/ga4/signals";
import { isoDaysAgo } from "@/lib/time";
import type { Ga4Signal, Ga4Snapshot } from "@/lib/types/client";

function isoDate(value: string) {
  return value.slice(0, 10);
}

export type SyncClientGa4Result = {
  snapshot: Ga4Snapshot;
  signals: Ga4Signal[];
};

export async function syncClientGa4(
  admin: SupabaseClient,
  clientId: number,
  propertyId: string,
): Promise<SyncClientGa4Result> {
  const endDate = isoDate(new Date().toISOString());
  const startDate = isoDate(isoDaysAgo(30));
  const prevEndDate = isoDate(isoDaysAgo(1));   // yesterday as end of prior window
  const prevStartDate = isoDate(isoDaysAgo(61));

  const { data: createdSnapshot, error: createError } = await admin
    .from("client_ga4_snapshots")
    .insert({
      client_id: clientId,
      property_id: propertyId,
      start_date: startDate,
      end_date: endDate,
      run_status: "running",
      totals: {},
      previous_totals: null,
      channel_breakdown: [],
      top_pages: [],
    })
    .select("*")
    .single<Ga4Snapshot>();
  if (createError || !createdSnapshot) {
    throw new Error(createError?.message ?? "Failed to create GA4 snapshot.");
  }

  try {
    const sync = await runGa4Sync(propertyId, startDate, endDate, prevStartDate, prevEndDate);

    const { error: updateError } = await admin
      .from("client_ga4_snapshots")
      .update({
        run_status: "completed",
        error_message: null,
        totals: sync.totals,
        previous_totals: sync.previousTotals,
        channel_breakdown: sync.channelBreakdown,
        top_pages: sync.topPages,
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id);
    if (updateError) throw new Error(updateError.message);

    await admin.from("client_ga4_signals").delete().eq("client_id", clientId);

    const signalDrafts = buildGa4Signals(sync.totals, sync.previousTotals, sync.channelBreakdown);
    if (signalDrafts.length > 0) {
      const { error: insertError } = await admin.from("client_ga4_signals").insert(
        signalDrafts.map((s) => ({ client_id: clientId, snapshot_id: createdSnapshot.id, ...s })),
      );
      if (insertError) throw new Error(insertError.message);
    }

    const [snapshotResult, signalsResult] = await Promise.all([
      admin.from("client_ga4_snapshots").select("*").eq("id", createdSnapshot.id).single<Ga4Snapshot>(),
      admin.from("client_ga4_signals").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).returns<Ga4Signal[]>(),
    ]);
    if (snapshotResult.error || !snapshotResult.data) {
      throw new Error(snapshotResult.error?.message ?? "Failed to reload GA4 snapshot.");
    }

    return { snapshot: snapshotResult.data, signals: signalsResult.data ?? [] };
  } catch (error) {
    await admin
      .from("client_ga4_snapshots")
      .update({
        run_status: "failed",
        error_message: error instanceof Error ? error.message : "GA4 sync failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id);
    throw error;
  }
}
