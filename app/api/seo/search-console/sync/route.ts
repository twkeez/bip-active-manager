import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSearchConsoleSync } from "@/lib/seo/search-console";
import { getGoogleAccessTokenForUser } from "@/lib/google/token-manager";
import { buildGscSignals } from "@/lib/seo/gsc-signals";
import type {
  GscPageMetric,
  GscQueryMetric,
  GscSignal,
  GscSnapshot,
} from "@/lib/types/client";
import type { GscDailyRow, GscSitemapEntry } from "@/lib/seo/search-console";

type SearchConsoleRequestBody = {
  clientId?: number;
};

function isoDateDaysAgo(days: number) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SearchConsoleRequestBody;
  try {
    body = (await request.json()) as SearchConsoleRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("id,website,sc_url")
    .eq("id", clientId)
    .single<{ id: number; website: string | null; sc_url: string | null }>();
  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }

  const startDate = isoDateDaysAgo(28);
  const endDate = isoDateDaysAgo(1);

  const { data: createdSnapshot, error: createSnapshotError } = await admin
    .from("client_gsc_snapshots")
    .insert({
      client_id: clientId,
      property_url: (clientRow.sc_url ?? "").trim() || (clientRow.website ?? "").trim(),
      start_date: startDate,
      end_date: endDate,
      run_status: "running",
    })
    .select("*")
    .single<GscSnapshot>();
  if (createSnapshotError || !createdSnapshot) {
    return NextResponse.json(
      {
        error:
          createSnapshotError?.message ?? "Failed to create Search Console snapshot",
      },
      { status: 500 },
    );
  }

  try {
    const userToken = await getGoogleAccessTokenForUser(admin, user.id).catch(() => null);
    const syncResult = await runSearchConsoleSync(
      clientRow.sc_url ?? "",
      clientRow.website ?? "",
      startDate,
      endDate,
      userToken ?? undefined,
    );

    if (syncResult.pageRows.length > 0) {
      const pagePayload = syncResult.pageRows.map((row) => ({
        client_id: clientId,
        snapshot_id: createdSnapshot.id,
        page_url: row.key,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));
      const { error: pageError } = await admin
        .from("client_gsc_page_metrics")
        .insert(pagePayload);
      if (pageError) {
        throw new Error(`Failed to store page metrics: ${pageError.message}`);
      }
    }

    if (syncResult.queryRows.length > 0) {
      const queryPayload = syncResult.queryRows.map((row) => ({
        client_id: clientId,
        snapshot_id: createdSnapshot.id,
        query: row.key,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));
      const { error: queryError } = await admin
        .from("client_gsc_query_metrics")
        .insert(queryPayload);
      if (queryError) {
        throw new Error(`Failed to store query metrics: ${queryError.message}`);
      }
    }

    const signals = buildGscSignals(syncResult.pageRows, syncResult.queryRows);
    if (signals.length > 0) {
      const signalPayload = signals.map((signal) => ({
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
      }));
      const { error: signalError } = await admin
        .from("client_gsc_signals")
        .insert(signalPayload);
      if (signalError) {
        throw new Error(`Failed to store Search Console signals: ${signalError.message}`);
      }
    }

    if (syncResult.dailyRows.length > 0) {
      const dailyPayload = syncResult.dailyRows.map((row) => ({
        client_id: clientId,
        snapshot_id: createdSnapshot.id,
        metric_date: row.date,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));
      const { error: dailyError } = await admin
        .from("client_gsc_daily_metrics")
        .insert(dailyPayload);
      if (dailyError) {
        throw new Error(`Failed to store GSC daily metrics: ${dailyError.message}`);
      }
    }

    if (syncResult.sitemaps.length > 0) {
      const sitemapPayload = syncResult.sitemaps.map((s) => ({
        client_id: clientId,
        snapshot_id: createdSnapshot.id,
        sitemap_url: s.sitemapUrl,
        last_submitted: s.lastSubmitted,
        last_downloaded: s.lastDownloaded,
        is_pending: s.isPending,
        is_sitemaps_index: s.isSitemapsIndex,
        errors: s.errors,
        warnings: s.warnings,
        urls_submitted: s.urlsSubmitted,
        urls_indexed: s.urlsIndexed,
      }));
      const { error: sitemapError } = await admin
        .from("client_gsc_sitemaps")
        .insert(sitemapPayload);
      if (sitemapError) {
        throw new Error(`Failed to store GSC sitemaps: ${sitemapError.message}`);
      }
    }

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
      throw new Error(
        updateSnapshotError?.message ?? "Failed to finalize Search Console snapshot",
      );
    }

    const { data: pageRows } = await admin
      .from("client_gsc_page_metrics")
      .select("*")
      .eq("snapshot_id", createdSnapshot.id)
      .order("impressions", { ascending: false })
      .limit(10)
      .returns<GscPageMetric[]>();
    const { data: queryRows } = await admin
      .from("client_gsc_query_metrics")
      .select("*")
      .eq("snapshot_id", createdSnapshot.id)
      .order("impressions", { ascending: false })
      .limit(10)
      .returns<GscQueryMetric[]>();
    const { data: signalRows } = await admin
      .from("client_gsc_signals")
      .select("*")
      .eq("snapshot_id", createdSnapshot.id)
      .order("created_at", { ascending: false })
      .returns<GscSignal[]>();

    return NextResponse.json({
      ok: true,
      snapshot: updatedSnapshot,
      pageMetrics: pageRows ?? [],
      queryMetrics: queryRows ?? [],
      signals: signalRows ?? [],
    });
  } catch (error) {
    await admin
      .from("client_gsc_snapshots")
      .update({
        run_status: "failed",
        error_message: error instanceof Error ? error.message : "Search Console sync failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search Console sync failed" },
      { status: 500 },
    );
  }
}
