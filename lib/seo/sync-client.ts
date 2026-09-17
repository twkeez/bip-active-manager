import type { SupabaseClient } from "@supabase/supabase-js";
import { runSearchConsoleSync } from "@/lib/seo/search-console";
import { buildGscSignals } from "@/lib/seo/gsc-signals";
import type { GscSnapshot } from "@/lib/types/client";

/**
 * One client's Search Console refresh.
 *
 * This was the body of the sync route until the nightly job needed it too. The
 * button and the schedule must do the same work for the same reason the ads
 * sync learned the hard way: a schedule that ran a lesser version of the job
 * would leave the same gap it exists to close.
 *
 * The snapshot row is written first with run_status 'running' and finished
 * either way, so a client page can tell "never synced" from "the last run
 * failed, and here is why".
 */

/** Search Console reports lag about a day; 28 days is what the screens read. */
const WINDOW_DAYS = 28;

function isoDateDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export type SearchConsoleSyncResult = {
  snapshot: GscSnapshot;
  pageCount: number;
  queryCount: number;
  signalCount: number;
};

export async function syncClientSearchConsole(
  admin: SupabaseClient,
  clientId: number,
  client: { sc_url?: string | null; website?: string | null },
  userAccessToken?: string,
): Promise<SearchConsoleSyncResult> {
  const startDate = isoDateDaysAgo(WINDOW_DAYS);
  const endDate = isoDateDaysAgo(1);

  const { data: createdSnapshot, error: createSnapshotError } = await admin
    .from("client_gsc_snapshots")
    .insert({
      client_id: clientId,
      property_url: (client.sc_url ?? "").trim() || (client.website ?? "").trim(),
      start_date: startDate,
      end_date: endDate,
      run_status: "running",
    })
    .select("*")
    .single<GscSnapshot>();
  if (createSnapshotError || !createdSnapshot) {
    throw new Error(createSnapshotError?.message ?? "Failed to create Search Console snapshot");
  }

  try {
    const syncResult = await runSearchConsoleSync(
      client.sc_url ?? "",
      client.website ?? "",
      startDate,
      endDate,
      userAccessToken,
    );

    const insert = async (table: string, rows: Array<Record<string, unknown>>, what: string) => {
      if (rows.length === 0) return;
      const { error } = await admin.from(table).insert(rows);
      if (error) throw new Error(`Failed to store ${what}: ${error.message}`);
    };

    await insert(
      "client_gsc_page_metrics",
      syncResult.pageRows.map((row) => ({
        client_id: clientId,
        snapshot_id: createdSnapshot.id,
        page_url: row.key,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
      "page metrics",
    );

    await insert(
      "client_gsc_query_metrics",
      syncResult.queryRows.map((row) => ({
        client_id: clientId,
        snapshot_id: createdSnapshot.id,
        query: row.key,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
      "query metrics",
    );

    const signals = buildGscSignals(syncResult.pageRows, syncResult.queryRows);
    await insert(
      "client_gsc_signals",
      signals.map((signal) => ({
        client_id: clientId,
        snapshot_id: createdSnapshot.id,
        signal_id: signal.signal_id,
        severity: signal.severity,
        title: signal.title,
        description: signal.description,
        suggestion: signal.suggestion,
        page_url: signal.page_url,
        query: signal.query,
        metric_value: signal.metric_value,
        occurrence_key: signal.occurrence_key,
      })),
      "Search Console signals",
    );

    await insert(
      "client_gsc_daily_metrics",
      syncResult.dailyRows.map((row) => ({
        client_id: clientId,
        snapshot_id: createdSnapshot.id,
        metric_date: row.date,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
      "GSC daily metrics",
    );

    await insert(
      "client_gsc_sitemaps",
      syncResult.sitemaps.map((sitemap) => ({
        client_id: clientId,
        snapshot_id: createdSnapshot.id,
        sitemap_url: sitemap.sitemapUrl,
        last_submitted: sitemap.lastSubmitted,
        last_downloaded: sitemap.lastDownloaded,
        is_pending: sitemap.isPending,
        is_sitemaps_index: sitemap.isSitemapsIndex,
        errors: sitemap.errors,
        warnings: sitemap.warnings,
        urls_submitted: sitemap.urlsSubmitted,
        urls_indexed: sitemap.urlsIndexed,
      })),
      "GSC sitemaps",
    );

    const { data: updatedSnapshot, error: updateSnapshotError } = await admin
      .from("client_gsc_snapshots")
      .update({
        property_url: syncResult.propertyUrl,
        run_status: "completed",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id)
      .select("*")
      .single<GscSnapshot>();
    if (updateSnapshotError || !updatedSnapshot) {
      throw new Error(updateSnapshotError?.message ?? "Failed to finalize Search Console snapshot");
    }

    return {
      snapshot: updatedSnapshot,
      pageCount: syncResult.pageRows.length,
      queryCount: syncResult.queryRows.length,
      signalCount: signals.length,
    };
  } catch (error) {
    await admin
      .from("client_gsc_snapshots")
      .update({
        run_status: "failed",
        error_message: error instanceof Error ? error.message : "Search Console sync failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id);
    throw error;
  }
}
