import { getGoogleAccessTokenForScope } from "@/lib/google/token-manager";
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
  /** Optional reports that could not be retrieved; their sections are stored as null. */
  failedReports: string[];
};

/**
 * Run the GA4 reports as the service account, and if the property refuses it
 * (403), as the stored Google connection that holds analytics.readonly.
 *
 * Found 2026-09-28: 53 of 88 properties had never granted the service account
 * access, so they were refused every night and counted as "blocked", while
 * Tom's own connection can read every one of them.
 */
async function runGa4WithFallback(
  admin: SupabaseClient,
  propertyId: string,
  window: { startDate: string; endDate: string; prevStartDate: string; prevEndDate: string },
  userAccessToken?: string,
) {
  const { startDate, endDate, prevStartDate, prevEndDate } = window;
  if (userAccessToken) return runGa4Sync(propertyId, startDate, endDate, prevStartDate, prevEndDate, userAccessToken);
  try {
    return await runGa4Sync(propertyId, startDate, endDate, prevStartDate, prevEndDate);
  } catch (error) {
    const refused = error instanceof Error && /\(403\)/.test(error.message);
    if (!refused) throw error;
    const stored = await getGoogleAccessTokenForScope(admin, "analytics.readonly").catch(() => null);
    if (!stored) throw error;
    return runGa4Sync(propertyId, startDate, endDate, prevStartDate, prevEndDate, stored);
  }
}

export async function syncClientGa4(
  admin: SupabaseClient,
  clientId: number,
  propertyId: string,
  userAccessToken?: string,
): Promise<SyncClientGa4Result> {
  const endDate = isoDate(new Date().toISOString());
  const startDate = isoDate(isoDaysAgo(30));
  // The 31 days before the current 31 (-30 .. today). This used to be
  // -61 .. yesterday, which overlaps the current period entirely and read
  // about twice the current numbers (found 2026-09-27).
  const prevEndDate = isoDate(isoDaysAgo(31));
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
      conversions_by_event: [],
      geo_breakdown: [],
      device_breakdown: [],
      source_medium_breakdown: [],
      new_vs_returning: [],
      sessions_trend: [],
      landing_pages: [],
    })
    .select("*")
    .single<Ga4Snapshot>();
  if (createError || !createdSnapshot) {
    throw new Error(createError?.message ?? "Failed to create GA4 snapshot.");
  }

  try {
    const sync = await runGa4WithFallback(
      admin,
      propertyId,
      { startDate, endDate, prevStartDate, prevEndDate },
      userAccessToken,
    );

    const { error: updateError } = await admin
      .from("client_ga4_snapshots")
      .update({
        run_status: "completed",
        // Completed, but say which optional reports could not be retrieved:
        // their sections are stored as null ("not retrieved"), not as empty.
        error_message: sync.failedReports.length
          ? `Partial: ${sync.failedReports.join(" | ").slice(0, 900)}`
          : null,
        totals: sync.totals,
        previous_totals: sync.previousTotals,
        channel_breakdown: sync.channelBreakdown,
        top_pages: sync.topPages,
        conversions_by_event: sync.conversionsByEvent,
        geo_breakdown: sync.geoBreakdown,
        device_breakdown: sync.deviceBreakdown,
        source_medium_breakdown: sync.sourceMediumBreakdown,
        new_vs_returning: sync.newVsReturning,
        sessions_trend: sync.sessionsTrend,
        landing_pages: sync.landingPages,
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

    return { snapshot: snapshotResult.data, signals: signalsResult.data ?? [], failedReports: sync.failedReports };
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
