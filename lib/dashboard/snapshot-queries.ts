import type { SupabaseClient } from "@supabase/supabase-js";
import type { BasecampSyncState, LighthouseSnapshot } from "@/lib/types/client";

const SNAPSHOT_SCAN_LIMIT = 500;

export type SignalSummary = {
  total: number;
  criticalCount: number;
  watchCount: number;
  hasCritical: boolean;
};

export type ClientFreshness = {
  adsUpdatedAt: string | null;
  gscUpdatedAt: string | null;
  lighthouseFetchedAt: string | null;
  crawlUpdatedAt: string | null;
  sitemapUpdatedAt: string | null;
  socialCreatedAt: string | null;
  gbpUpdatedAt: string | null;
};

export type LightweightThreadPreview = {
  basecamp_project_id: string;
  thread_title: string | null;
  thread_excerpt: string | null;
  occurred_at: string;
};

function latestByClientId<T extends { client_id: number; created_at?: string }>(
  rows: T[],
): Map<number, T> {
  const map = new Map<number, T>();
  for (const row of rows) {
    const existing = map.get(row.client_id);
    if (!existing) {
      map.set(row.client_id, row);
      continue;
    }
    const existingAt = existing.created_at ?? "";
    const rowAt = row.created_at ?? "";
    if (rowAt > existingAt) {
      map.set(row.client_id, row);
    }
  }
  return map;
}

export async function fetchLatestSnapshotsByClient<T extends { client_id: number; created_at?: string }>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  clientId?: number,
): Promise<T[]> {
  let query = supabase
    .from(table)
    .select(select)
    .order("created_at", { ascending: false })
    .limit(SNAPSHOT_SCAN_LIMIT);
  if (clientId != null) {
    query = query.eq("client_id", clientId);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return [...latestByClientId(data as unknown as T[]).values()];
}

export async function fetchLighthouseSnapshots(
  supabase: SupabaseClient,
  clientId?: number,
): Promise<LighthouseSnapshot[]> {
  let primaryQuery = supabase
    .from("client_lighthouse_snapshots")
    .select("client_id,url,fetched_at,seo_blockers,helpdesk_items,scores,metrics,updated_at");
  if (clientId != null) {
    primaryQuery = primaryQuery.eq("client_id", clientId);
  }
  const primary = await primaryQuery;
  if (
    primary.error &&
    /seo_blockers|helpdesk_items/i.test(primary.error.message)
  ) {
    let fallbackQuery = supabase
      .from("client_lighthouse_snapshots")
      .select("client_id,url,fetched_at,scores,metrics,updated_at");
    if (clientId != null) {
      fallbackQuery = fallbackQuery.eq("client_id", clientId);
    }
    const fallback = await fallbackQuery;
    if (fallback.error || !fallback.data) return [];
    return (fallback.data as Array<Omit<LighthouseSnapshot, "seo_blockers" | "helpdesk_items">>).map(
      (row) => ({
        ...row,
        seo_blockers: [],
        helpdesk_items: [],
      }),
    );
  }
  if (primary.error || !primary.data) return [];
  if (clientId != null) {
    return primary.data ? [primary.data as unknown as LighthouseSnapshot] : [];
  }
  const byClient = new Map<number, LighthouseSnapshot>();
  for (const row of primary.data as LighthouseSnapshot[]) {
    if (!byClient.has(row.client_id)) {
      byClient.set(row.client_id, row);
    }
  }
  return [...byClient.values()];
}

export async function fetchLighthouseSnapshot(
  supabase: SupabaseClient,
  clientId: number,
): Promise<LighthouseSnapshot | null> {
  const rows = await fetchLighthouseSnapshots(supabase, clientId);
  return rows[0] ?? null;
}

function groupSignalSummaries(
  rows: Array<{ client_id: number; severity: string }>,
): Record<number, SignalSummary> {
  const grouped: Record<number, { criticalCount: number; watchCount: number }> = {};
  for (const row of rows) {
    if (!grouped[row.client_id]) {
      grouped[row.client_id] = { criticalCount: 0, watchCount: 0 };
    }
    if (row.severity === "critical") {
      grouped[row.client_id]!.criticalCount += 1;
    } else if (row.severity === "watch") {
      grouped[row.client_id]!.watchCount += 1;
    }
  }
  const result: Record<number, SignalSummary> = {};
  for (const [clientIdRaw, counts] of Object.entries(grouped)) {
    const clientId = Number(clientIdRaw);
    const total = counts.criticalCount + counts.watchCount;
    result[clientId] = {
      total,
      criticalCount: counts.criticalCount,
      watchCount: counts.watchCount,
      hasCritical: counts.criticalCount > 0,
    };
  }
  return result;
}

export async function fetchGscSignalSummariesByClient(
  supabase: SupabaseClient,
): Promise<Record<number, SignalSummary>> {
  const { data, error } = await supabase
    .from("client_gsc_signals")
    .select("client_id, severity");
  if (error || !data) return {};
  return groupSignalSummaries(data as Array<{ client_id: number; severity: string }>);
}

export async function fetchAdsSignalSummariesByClient(
  supabase: SupabaseClient,
): Promise<Record<number, SignalSummary>> {
  const { data, error } = await supabase
    .from("client_ads_signals")
    .select("client_id, severity");
  if (error || !data) return {};
  return groupSignalSummaries(data as Array<{ client_id: number; severity: string }>);
}

export async function fetchSnapshotFreshnessByClient(
  supabase: SupabaseClient,
): Promise<Record<number, ClientFreshness>> {
  const [
    adsRows,
    gscRows,
    lighthouseRows,
    crawlRows,
    sitemapRows,
    socialRows,
    gbpRows,
  ] = await Promise.all([
    fetchLatestSnapshotsByClient<{ client_id: number; updated_at: string; created_at?: string }>(
      supabase,
      "client_ads_snapshots",
      "client_id, updated_at, created_at",
    ),
    fetchLatestSnapshotsByClient<{ client_id: number; updated_at: string; created_at?: string }>(
      supabase,
      "client_gsc_snapshots",
      "client_id, updated_at, created_at",
    ),
    fetchLatestSnapshotsByClient<{ client_id: number; fetched_at: string; created_at?: string }>(
      supabase,
      "client_lighthouse_snapshots",
      "client_id, fetched_at, created_at",
    ),
    fetchLatestSnapshotsByClient<{ client_id: number; updated_at: string; created_at?: string }>(
      supabase,
      "client_seo_crawl_snapshots",
      "client_id, updated_at, created_at",
    ),
    fetchLatestSnapshotsByClient<{ client_id: number; updated_at: string; created_at?: string }>(
      supabase,
      "client_sitemap_snapshots",
      "client_id, updated_at, created_at",
    ),
    fetchLatestSnapshotsByClient<{ client_id: number; created_at: string }>(
      supabase,
      "client_social_daily_snapshots",
      "client_id, created_at",
    ),
    fetchLatestSnapshotsByClient<{ client_id: number; updated_at: string; created_at?: string }>(
      supabase,
      "client_gbp_snapshots",
      "client_id, updated_at, created_at",
    ),
  ]);

  const clientIds = new Set<number>();
  for (const rows of [adsRows, gscRows, lighthouseRows, crawlRows, sitemapRows, socialRows, gbpRows]) {
    for (const row of rows) clientIds.add(row.client_id);
  }

  const freshness: Record<number, ClientFreshness> = {};
  const adsByClient = new Map(adsRows.map((row) => [row.client_id, row]));
  const gscByClient = new Map(gscRows.map((row) => [row.client_id, row]));
  const lighthouseByClient = new Map(lighthouseRows.map((row) => [row.client_id, row]));
  const crawlByClient = new Map(crawlRows.map((row) => [row.client_id, row]));
  const sitemapByClient = new Map(sitemapRows.map((row) => [row.client_id, row]));
  const socialByClient = new Map(socialRows.map((row) => [row.client_id, row]));
  const gbpByClient = new Map(gbpRows.map((row) => [row.client_id, row]));

  for (const clientId of clientIds) {
    freshness[clientId] = {
      adsUpdatedAt: adsByClient.get(clientId)?.updated_at ?? null,
      gscUpdatedAt: gscByClient.get(clientId)?.updated_at ?? null,
      lighthouseFetchedAt: lighthouseByClient.get(clientId)?.fetched_at ?? null,
      crawlUpdatedAt: crawlByClient.get(clientId)?.updated_at ?? null,
      sitemapUpdatedAt: sitemapByClient.get(clientId)?.updated_at ?? null,
      socialCreatedAt: socialByClient.get(clientId)?.created_at ?? null,
      gbpUpdatedAt: gbpByClient.get(clientId)?.updated_at ?? null,
    };
  }
  return freshness;
}

export async function fetchHasAdsSnapshotByClient(
  supabase: SupabaseClient,
): Promise<Record<number, boolean>> {
  const rows = await fetchLatestSnapshotsByClient<{ client_id: number; created_at?: string }>(
    supabase,
    "client_ads_snapshots",
    "client_id, created_at",
  );
  return Object.fromEntries(rows.map((row) => [row.client_id, true]));
}

export async function fetchLightweightThreadPreviews(
  supabase: SupabaseClient,
  cutoffIso: string,
): Promise<LightweightThreadPreview[]> {
  const { data, error } = await supabase
    .from("basecamp_communication_events")
    .select("basecamp_project_id, thread_title, thread_excerpt, occurred_at")
    .gte("occurred_at", cutoffIso)
    .order("occurred_at", { ascending: false })
    .limit(800);
  if (error && /does not exist|relation/i.test(error.message)) return [];
  return (data ?? []) as LightweightThreadPreview[];
}

export function computeDuplicateBasecampProjectCounts(
  clients: Array<{ basecamp_project_id: string | null }>,
): Record<string, number> {
  const projectIdCounts = new Map<string, number>();
  for (const client of clients) {
    const projectId = client.basecamp_project_id?.trim();
    if (!projectId) continue;
    projectIdCounts.set(projectId, (projectIdCounts.get(projectId) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...projectIdCounts.entries()].filter(([, count]) => count > 1),
  );
}

export async function fetchBasecampSyncState(
  supabase: SupabaseClient,
): Promise<BasecampSyncState | null> {
  const { data: syncStateRaw, error: syncStateError } = await supabase
    .from("basecamp_sync_state")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (syncStateError && /does not exist|relation/i.test(syncStateError.message)) {
    return null;
  }
  return (syncStateRaw as BasecampSyncState | null) ?? null;
}
