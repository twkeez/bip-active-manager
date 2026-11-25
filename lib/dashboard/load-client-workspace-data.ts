import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDaysAgo } from "@/lib/time";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import type { ClientWorkspaceInitialData } from "@/lib/dashboard/client-workspace-types";
import {
  fetchLatestSnapshotsByClient,
  fetchLighthouseSnapshot,
} from "@/lib/dashboard/snapshot-queries";
import type {
  AdsSignal,
  AdsSnapshot,
  MetaAdsSnapshot,
  BasecampThreadEvent,
  ClientRow,
  Ga4Signal,
  Ga4Snapshot,
  GbpReviewRow,
  GbpSnapshot,
  GscPageMetric,
  GscQueryMetric,
  GscSignal,
  GscSnapshot,
  LighthouseOccurrenceOverride,
  LighthouseSnapshot,
  SeoCrawlIssue,
  SeoCrawlSnapshot,
  SitemapSnapshot,
  SitemapUrlRow,
  SocialConnection,
  SocialDailySnapshot,
  SocialPostSnapshot,
  SocialSignal,
} from "@/lib/types/client";

/**
 * Things the loader could not read, or read only in part, in words a person
 * can act on. The workspace still renders; the client report refuses to
 * export over any of them (lib/reporting/load-report.ts), because a section
 * that failed to load must never reach a client looking like "no activity".
 */
type ReadProblems = string[];

function noteError(problems: ReadProblems, label: string, error: { message: string } | null | undefined) {
  if (error) problems.push(`${label} could not be read: ${error.message}`);
}

/**
 * A newest-first list read with a row limit was cut inside the window the
 * report covers: it came back full and its oldest row is still in the window,
 * so rows the report needs were left out.
 */
export function cutInsideWindow<T, V extends string | number>(
  rows: readonly T[],
  limit: number,
  dateOf: (row: T) => V | null | undefined,
  windowStart: V,
): boolean {
  if (rows.length < limit) return false;
  const oldest = dateOf(rows[rows.length - 1]);
  return oldest != null && oldest >= windowStart;
}

async function fetchLatestSnapshotForClient<T extends { id: number }>(
  supabase: SupabaseClient,
  table: string,
  clientId: number,
  problems: ReadProblems,
  label: string,
  completedOnly: boolean,
): Promise<T | null> {
  let query = supabase.from(table).select("*").eq("client_id", clientId);
  if (completedOnly) query = query.eq("run_status", "completed");
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  noteError(problems, label, error);
  if (error || !data) return null;
  return data as T;
}

export type WorkspaceLoadOptions = {
  /**
   * Only snapshots whose sync finished. The client report uses this, so its
   * numbers come from the last good sync rather than a run that is still going
   * or failed (whose totals are empty).
   */
  completedOnly?: boolean;
};

/** The report's window: everything it sums covers the last 30 days. */
const REPORT_WINDOW_DAYS = 30;

export async function loadClientWorkspaceData(
  supabase: SupabaseClient,
  clientId: number,
  options: WorkspaceLoadOptions = {},
): Promise<ClientWorkspaceInitialData | null> {
  const completedOnly = options.completedOnly ?? false;
  const readProblems: ReadProblems = [];
  const windowStartIso = isoDaysAgo(REPORT_WINDOW_DAYS);
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle<ClientRow>();
  if (clientError || !client) return null;

  // Every Basecamp event of the last 30 days (this stopped at 200).
  let threadEvents: BasecampThreadEvent[] = [];
  try {
    threadEvents = await fetchAllRows<BasecampThreadEvent>(
      (from, to) =>
        supabase
          .from("basecamp_communication_events")
          .select(
            "id,client_id,basecamp_project_id,basecamp_recording_id,parent_recording_id,kind,occurred_at,author_email,is_internal,thread_title,thread_excerpt,thread_body,thread_url",
          )
          .eq("client_id", clientId)
          .gte("occurred_at", windowStartIso)
          .order("occurred_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      "Basecamp activity",
    );
  } catch (error) {
    readProblems.push(error instanceof Error ? error.message : "Basecamp activity could not be read");
  }

  const lighthouseSnapshot: LighthouseSnapshot | null = await fetchLighthouseSnapshot(
    supabase,
    clientId,
  );

  const { data: lighthouseOverridesRaw } = await supabase
    .from("client_lighthouse_occurrence_overrides")
    .select("id,client_id,audit_id,occurrence_key,decision,created_at")
    .eq("client_id", clientId)
    .eq("decision", "no_fix_needed");
  const lighthouseOverrides = (lighthouseOverridesRaw ??
    []) as LighthouseOccurrenceOverride[];

  let seoCrawlSnapshot: SeoCrawlSnapshot | null = null;
  let seoCrawlIssues: SeoCrawlIssue[] = [];
  seoCrawlSnapshot = await fetchLatestSnapshotForClient<SeoCrawlSnapshot>(
    supabase,
    "client_seo_crawl_snapshots",
    clientId,
    readProblems,
    "The site crawl",
    completedOnly,
  );
  if (seoCrawlSnapshot) {
    const issuesQuery = await supabase
      .from("client_seo_crawl_issues")
      .select("*")
      .eq("snapshot_id", seoCrawlSnapshot.id)
      .order("created_at", { ascending: false });
    noteError(readProblems, "Site crawl issues", issuesQuery.error);
    if (!issuesQuery.error) {
      seoCrawlIssues = (issuesQuery.data ?? []) as SeoCrawlIssue[];
    }
  }

  let gscSnapshot: GscSnapshot | null = null;
  let gscSignals: GscSignal[] = [];
  let gscPageMetrics: GscPageMetric[] = [];
  let gscQueryMetrics: GscQueryMetric[] = [];
  gscSnapshot = await fetchLatestSnapshotForClient<GscSnapshot>(
    supabase,
    "client_gsc_snapshots",
    clientId,
    readProblems,
    "The Search Console sync",
    completedOnly,
  );
  if (gscSnapshot) {
    const [signalsQuery, pageMetricsQuery, queryMetricsQuery] = await Promise.all([
      supabase
        .from("client_gsc_signals")
        .select("*")
        .eq("snapshot_id", gscSnapshot.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_gsc_page_metrics")
        .select("*")
        .eq("snapshot_id", gscSnapshot.id)
        .order("impressions", { ascending: false })
        .limit(250),
      supabase
        .from("client_gsc_query_metrics")
        .select("*")
        .eq("snapshot_id", gscSnapshot.id)
        .order("impressions", { ascending: false })
        .limit(250),
    ]);
    noteError(readProblems, "Search Console alerts", signalsQuery.error);
    noteError(readProblems, "Search Console pages", pageMetricsQuery.error);
    noteError(readProblems, "Search Console queries", queryMetricsQuery.error);
    if (!signalsQuery.error) gscSignals = (signalsQuery.data ?? []) as GscSignal[];
    if (!pageMetricsQuery.error) {
      gscPageMetrics = (pageMetricsQuery.data ?? []) as GscPageMetric[];
    }
    if (!queryMetricsQuery.error) {
      gscQueryMetrics = (queryMetricsQuery.data ?? []) as GscQueryMetric[];
    }
  }

  let sitemapSnapshot: SitemapSnapshot | null = null;
  let sitemapUrls: SitemapUrlRow[] = [];
  sitemapSnapshot = await fetchLatestSnapshotForClient<SitemapSnapshot>(
    supabase,
    "client_sitemap_snapshots",
    clientId,
    readProblems,
    "The sitemap check",
    completedOnly,
  );
  if (sitemapSnapshot) {
    const urlsQuery = await supabase
      .from("client_sitemap_urls")
      .select("*")
      .eq("snapshot_id", sitemapSnapshot.id)
      .order("effective_updated_at", { ascending: true })
      .limit(1000);
    noteError(readProblems, "Sitemap addresses", urlsQuery.error);
    if (!urlsQuery.error) {
      sitemapUrls = (urlsQuery.data ?? []) as SitemapUrlRow[];
    }
  }

  const [connectionsQuery, dailyQuery, postsQuery, signalsQuery] = await Promise.all([
    supabase
      .from("client_social_connections")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("client_social_daily_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("snapshot_date", { ascending: false })
      .limit(500),
    supabase
      .from("client_social_post_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("published_at", { ascending: false })
      .limit(500),
    supabase
      .from("client_social_signals")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  noteError(readProblems, "Social connections", connectionsQuery.error);
  noteError(readProblems, "Daily social numbers", dailyQuery.error);
  noteError(readProblems, "Social posts", postsQuery.error);
  noteError(readProblems, "Social alerts", signalsQuery.error);
  const socialConnections = (connectionsQuery.data ?? []) as SocialConnection[];
  const socialDailySnapshots = (dailyQuery.data ?? []) as SocialDailySnapshot[];
  const socialPostSnapshots = (postsQuery.data ?? []) as SocialPostSnapshot[];
  const socialSignals = (signalsQuery.data ?? []) as SocialSignal[];
  // These lists are read newest first, up to 500 rows. That covers the
  // report's 30 days for every client seen so far; if it ever doesn't, say so.
  if (cutInsideWindow(socialDailySnapshots, 500, (row) => row.snapshot_date, windowStartIso.slice(0, 10))) {
    readProblems.push("Only the newest 500 daily social rows were read, and all of them fall inside the last 30 days, so some days are missing.");
  }
  if (cutInsideWindow(socialPostSnapshots, 500, (row) => row.published_at, windowStartIso)) {
    readProblems.push("Only the newest 500 social posts were read, and all of them fall inside the last 30 days, so some posts are missing.");
  }

  let adsSnapshot: AdsSnapshot | null = null;
  let adsSignals: AdsSignal[] = [];
  const adsSnapshots = await fetchLatestSnapshotsByClient<AdsSnapshot>(
    supabase,
    "client_ads_snapshots",
    "*",
    clientId,
    { completedOnly },
  );
  adsSnapshot = adsSnapshots[0] ?? null;
  if (adsSnapshot) {
    const adsSignalsQuery = await supabase
      .from("client_ads_signals")
      .select("*")
      .eq("snapshot_id", adsSnapshot.id)
      .order("created_at", { ascending: false });
    noteError(readProblems, "Google Ads alerts", adsSignalsQuery.error);
    if (!adsSignalsQuery.error) {
      adsSignals = (adsSignalsQuery.data ?? []) as AdsSignal[];
    }
  }

  const metaAdsSnapshots = await fetchLatestSnapshotsByClient<MetaAdsSnapshot>(
    supabase,
    "client_meta_ads_snapshots",
    "*",
    clientId,
    { completedOnly },
  );
  const metaAdsSnapshot: MetaAdsSnapshot | null = metaAdsSnapshots[0] ?? null;

  let ga4Snapshot: Ga4Snapshot | null = null;
  let ga4Signals: Ga4Signal[] = [];
  ga4Snapshot = await fetchLatestSnapshotForClient<Ga4Snapshot>(
    supabase,
    "client_ga4_snapshots",
    clientId,
    readProblems,
    "The Google Analytics sync",
    completedOnly,
  );
  if (ga4Snapshot) {
    const ga4SignalsQuery = await supabase
      .from("client_ga4_signals")
      .select("*")
      .eq("snapshot_id", ga4Snapshot.id)
      .order("created_at", { ascending: false });
    noteError(readProblems, "Google Analytics alerts", ga4SignalsQuery.error);
    if (!ga4SignalsQuery.error) {
      ga4Signals = (ga4SignalsQuery.data ?? []) as Ga4Signal[];
    }
  }

  let gbpSnapshot: GbpSnapshot | null = null;
  let gbpReviews: GbpReviewRow[] = [];
  gbpSnapshot = await fetchLatestSnapshotForClient<GbpSnapshot>(
    supabase,
    "client_gbp_snapshots",
    clientId,
    readProblems,
    "The Google Business Profile sync",
    completedOnly,
  );
  if (gbpSnapshot) {
    // The client's stored reviews are always one set (lib/gbp/sync-client.ts
    // replaces them whole, and keeps the old set when the API doesn't answer),
    // so they are read by client. Read by the newest snapshot, they vanished
    // whenever a sync kept the previous set.
    const reviewsQuery = await supabase
      .from("client_gbp_reviews")
      .select("*")
      .eq("client_id", clientId)
      .order("review_time_unix", { ascending: false, nullsFirst: false })
      .limit(500);
    noteError(readProblems, "Google reviews", reviewsQuery.error);
    if (!reviewsQuery.error) {
      gbpReviews = (reviewsQuery.data ?? []) as GbpReviewRow[];
    }
    const windowStartUnix = Math.floor(new Date(windowStartIso).getTime() / 1000);
    if (cutInsideWindow(gbpReviews, 500, (row) => row.review_time_unix, windowStartUnix)) {
      readProblems.push("Only the newest 500 Google reviews were read, and all of them fall inside the last 30 days, so some reviews are missing.");
    }
  }

  let hasDuplicateBasecampProjectId = false;
  const projectId = client.basecamp_project_id?.trim();
  if (projectId) {
    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("basecamp_project_id", projectId);
    hasDuplicateBasecampProjectId = (count ?? 0) > 1;
  }

  return {
    client,
    threadEvents,
    lighthouseSnapshot,
    lighthouseOverrides,
    seoCrawlSnapshot,
    seoCrawlIssues,
    gscSnapshot,
    gscSignals,
    gscPageMetrics,
    gscQueryMetrics,
    sitemapSnapshot,
    sitemapUrls,
    socialConnections,
    socialDailySnapshots,
    socialPostSnapshots,
    socialSignals,
    adsSnapshot,
    adsSignals,
    metaAdsSnapshot,
    ga4Snapshot,
    ga4Signals,
    gbpSnapshot,
    gbpReviews,
    hasDuplicateBasecampProjectId,
    readProblems,
  };
}

export function workspaceDataToManagerProps(data: ClientWorkspaceInitialData) {
  const clientId = data.client.id;
  return {
    initialClients: [data.client],
    initialThreadEvents: data.threadEvents,
    initialLighthouseSnapshots: data.lighthouseSnapshot ? [data.lighthouseSnapshot] : [],
    initialLighthouseOverrides: data.lighthouseOverrides,
    initialSeoCrawlSnapshots: data.seoCrawlSnapshot ? [data.seoCrawlSnapshot] : [],
    initialSeoCrawlIssues: data.seoCrawlIssues,
    initialGscSnapshots: data.gscSnapshot ? [data.gscSnapshot] : [],
    initialGscSignals: data.gscSignals,
    initialGscPageMetrics: data.gscPageMetrics,
    initialGscQueryMetrics: data.gscQueryMetrics,
    initialSitemapSnapshots: data.sitemapSnapshot ? [data.sitemapSnapshot] : [],
    initialSitemapUrls: data.sitemapUrls,
    initialSocialConnections: data.socialConnections,
    initialSocialDailySnapshots: data.socialDailySnapshots,
    initialSocialPostSnapshots: data.socialPostSnapshots,
    initialSocialSignals: data.socialSignals,
    initialAdsSnapshots: data.adsSnapshot ? [data.adsSnapshot] : [],
    initialAdsSignals: data.adsSignals,
    initialGa4Snapshots: data.ga4Snapshot ? [data.ga4Snapshot] : [],
    initialGbpSnapshots: data.gbpSnapshot ? [data.gbpSnapshot] : [],
    initialGbpReviews: data.gbpReviews,
    duplicateProjectIdCounts: data.hasDuplicateBasecampProjectId
      ? {
          [data.client.basecamp_project_id!.trim()]: 2,
        }
      : {},
    workspaceClientId: clientId,
  };
}
