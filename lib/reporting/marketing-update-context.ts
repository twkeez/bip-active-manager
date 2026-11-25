import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runKeywordHealthComparison } from "@/lib/seo/search-console";
import {
  defaultMarketingUpdateGreeting,
  defaultMarketingUpdateTitle,
  formatAverageCpcFromMicros,
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatDateRangeLabel,
  type MarketingUpdateContextSummary,
} from "@/lib/reporting/marketing-update-format";
import { websiteLabel } from "@/lib/reporting/format";
import type {
  AdsSnapshot,
  ClientRow,
  GbpSnapshot,
  GscSnapshot,
  KeywordHealthRow,
  SocialDailySnapshot,
} from "@/lib/types/client";

export {
  defaultMarketingUpdateGreeting,
  defaultMarketingUpdateTitle,
  formatAverageCpcFromMicros,
  formatCompactNumber,
  formatCurrencyFromMicros,
  formatDateRangeLabel,
  type MarketingUpdateContextSummary,
} from "@/lib/reporting/marketing-update-format";

export type MarketingUpdateGbpManual = {
  totalInteractions?: number | null;
  phoneCalls?: number | null;
  directionRequests?: number | null;
  websiteClicks?: number | null;
};

export type MarketingUpdateUserInput = {
  title?: string;
  greeting?: string;
  startDate?: string;
  endDate?: string;
  gbpManual?: MarketingUpdateGbpManual;
  clientRequests?: string;
  nextMeetingUrl?: string;
  additionalNotes?: string;
};

export type MarketingUpdateAdsMetrics = {
  clicks: number;
  impressions: number;
  averageCpcMicros: number;
  costMicros: number;
  conversions: number;
  clicksLabel: string;
  impressionsLabel: string;
  averageCpcLabel: string;
  costLabel: string;
  startDate: string;
  endDate: string;
  dateRangeLabel: string;
};

export type MarketingUpdateGbpMetrics = {
  totalInteractions: number | null;
  phoneCalls: number | null;
  directionRequests: number | null;
  websiteClicks: number | null;
  rating: number | null;
  reviewCount: number | null;
  recentReviews30d: number;
  hasManualInteractions: boolean;
};

export type MarketingUpdateOptionalChannel = {
  id: "search_console" | "facebook" | "keywords";
  label: string;
  summary: string;
};

export type MarketingUpdateContext = {
  client: {
    id: number;
    accountName: string;
    marketingStrategist: string | null;
    websiteLabel: string;
    activeServices: string[];
  };
  title: string;
  greeting: string;
  window: {
    startDate: string;
    endDate: string;
    dateRangeLabel: string;
  };
  ads: MarketingUpdateAdsMetrics | null;
  gbp: MarketingUpdateGbpMetrics | null;
  optionalChannels: MarketingUpdateOptionalChannel[];
  workInProgressHints: string[];
  clientRequests: string | null;
  nextMeetingUrl: string | null;
  additionalNotes: string | null;
  channelsIncluded: string[];
  /** Parts that could not be read, so the draft leaves them out; shown to the strategist. */
  unavailable: string[];
};

function norm(value: string | null | undefined) {
  return (value ?? "").trim();
}

function isoDateDaysAgo(days: number) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function deriveActiveServices(client: ClientRow): string[] {
  const services: string[] = [];
  if (norm(client.ppc)) services.push("Google Ads");
  if (norm(client.seo)) services.push("Local Search Visibility");
  if (norm(client.smm)) services.push("Social Media");
  if (norm(client.blog)) services.push("Content / Blog");
  if (norm(client.orm)) services.push("Online Reputation");
  return services;
}

function deriveWorkInProgressHints(activeServices: string[]): string[] {
  const hints: string[] = [];
  if (activeServices.includes("Google Ads")) {
    hints.push("Google Ads optimization — refining campaigns, search terms, and ad copy.");
  }
  if (activeServices.includes("Local Search Visibility")) {
    hints.push("Local search visibility — improving GBP presence and on-site SEO.");
  }
  if (activeServices.includes("Social Media")) {
    hints.push("Social media — planning and publishing engaging content.");
  }
  if (activeServices.includes("Content / Blog")) {
    hints.push("Content marketing — developing helpful articles for pet owners.");
  }
  if (hints.length === 0) {
    hints.push("Ongoing marketing support across your active channels.");
  }
  return hints;
}

function toAdsMetrics(snapshot: AdsSnapshot): MarketingUpdateAdsMetrics {
  const { totals, start_date, end_date } = snapshot;
  return {
    clicks: totals.clicks,
    impressions: totals.impressions,
    averageCpcMicros: totals.average_cpc,
    costMicros: totals.cost_micros,
    conversions: totals.conversions,
    clicksLabel: formatCompactNumber(totals.clicks),
    impressionsLabel: formatCompactNumber(totals.impressions),
    averageCpcLabel: formatAverageCpcFromMicros(totals.average_cpc),
    costLabel: formatCurrencyFromMicros(totals.cost_micros),
    startDate: start_date,
    endDate: end_date,
    dateRangeLabel: formatDateRangeLabel(start_date, end_date),
  };
}

function countRecentGbpReviews(
  reviews: Array<{ review_time_unix: number | null }>,
  days = 30,
) {
  const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  return reviews.filter((row) => (row.review_time_unix ?? 0) >= cutoff).length;
}

function pickKeywordHighlights(rows: KeywordHealthRow[], limit = 3): string[] {
  return rows
    .filter((row) => row.current_position != null)
    .sort((left, right) => {
      const leftGain = (left.previous_position ?? left.current_position!) - left.current_position!;
      const rightGain =
        (right.previous_position ?? right.current_position!) - right.current_position!;
      return rightGain - leftGain;
    })
    .slice(0, limit)
    .map((row) => {
      const delta =
        row.previous_position != null && row.current_position != null
          ? row.previous_position - row.current_position
          : null;
      const deltaLabel =
        delta == null
          ? `position ${row.current_position!.toFixed(1)}`
          : delta > 0
            ? `improved ${delta.toFixed(1)} positions to ${row.current_position!.toFixed(1)}`
            : `at position ${row.current_position!.toFixed(1)}`;
      return `"${row.keyword}" ${deltaLabel}`;
    });
}

async function loadKeywordHighlights(
  client: Pick<ClientRow, "sc_url" | "website">,
  unavailable: string[],
): Promise<string[]> {
  if (!norm(client.sc_url)) return [];
  try {
    const result = await runKeywordHealthComparison(
      client.sc_url ?? "",
      client.website ?? "",
    );
    const currentByKeyword = new Map<string, KeywordHealthRow>();
    for (const row of result.currentRows.slice(0, 30)) {
      const key = row.query.trim().toLowerCase();
      if (!key) continue;
      currentByKeyword.set(key, {
        keyword: row.query,
        page_url: row.page,
        current_position: row.position,
        previous_position: null,
        position_delta: 0,
        current_clicks: row.clicks,
        previous_clicks: 0,
        current_impressions: row.impressions,
        previous_impressions: 0,
        dropped_by_3_plus: false,
      });
    }
    for (const row of result.previousRows) {
      const key = row.query.trim().toLowerCase();
      const existing = currentByKeyword.get(key);
      if (!existing) continue;
      existing.previous_position = row.position;
      existing.previous_clicks = row.clicks;
      existing.previous_impressions = row.impressions;
      if (existing.current_position != null && row.position != null) {
        existing.position_delta = existing.current_position - row.position;
        existing.dropped_by_3_plus = existing.position_delta >= 3;
      }
    }
    return pickKeywordHighlights([...currentByKeyword.values()]);
  } catch (error) {
    // Was `return []`, which read as "no keyword movement worth mentioning".
    unavailable.push(`Keyword movement could not be read from Search Console: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function summarizeMarketingUpdateContext(
  context: MarketingUpdateContext,
): MarketingUpdateContextSummary {
  return {
    channelsIncluded: context.channelsIncluded,
    hasAds: context.ads != null,
    hasGbp: context.gbp != null,
    hasGbpManualInteractions: context.gbp?.hasManualInteractions ?? false,
    hasSearchConsole: context.optionalChannels.some((row) => row.id === "search_console"),
    hasFacebook: context.optionalChannels.some((row) => row.id === "facebook"),
    hasKeywords: context.optionalChannels.some((row) => row.id === "keywords"),
    dateRangeLabel: context.window.dateRangeLabel,
    unavailable: context.unavailable,
  };
}

export async function buildMarketingUpdateContext(
  admin: SupabaseClient,
  clientId: number,
  userInput: MarketingUpdateUserInput = {},
): Promise<MarketingUpdateContext> {
  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single<ClientRow>();
  if (clientError || !clientRow) {
    throw new Error(clientError?.message ?? "Client not found");
  }

  // A failed read stops the update with its reason (the route shows it), rather
  // than quietly leaving a channel out of copy that goes to the client.
  const must = <T,>(result: { data: T; error: { message: string } | null }, what: string): T => {
    if (result.error) throw new Error(`${what} could not be read: ${result.error.message}`);
    return result.data;
  };
  const unavailable: string[] = [];

  const adsSnapshot = must(await admin
    .from("client_ads_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AdsSnapshot>(), "Google Ads");

  const gbpSnapshot = must(await admin
    .from("client_gbp_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GbpSnapshot>(), "Google Business Profile");

  // Reviews are stored as one set per client (lib/gbp/sync-client.ts), so they
  // are read by client: read by the newest snapshot they vanished whenever a
  // sync kept the previous set.
  const gbpReviews = gbpSnapshot
    ? await fetchAllRows<{ review_time_unix: number | null }>(
        (from, to) =>
          admin
            .from("client_gbp_reviews")
            .select("id, review_time_unix")
            .eq("client_id", clientId)
            .order("id", { ascending: true })
            .range(from, to),
        "Google reviews",
      )
    : [];

  // Search numbers from the last finished sync, as whole-site day-by-day
  // totals (what Google's Performance report shows), not the pages added up.
  const latestGscSnapshot = must(await admin
    .from("client_gsc_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GscSnapshot>(), "Search Console");

  const gscDailyRows = latestGscSnapshot
    ? await fetchAllRows<{ clicks: number; impressions: number }>(
        (from, to) =>
          admin
            .from("client_gsc_daily_metrics")
            .select("id, clicks, impressions")
            .eq("snapshot_id", latestGscSnapshot.id)
            .order("id", { ascending: true })
            .range(from, to),
        "Search Console daily totals",
      )
    : [];

  const socialCutoff = isoDateDaysAgo(30);
  const socialRows = must(await admin
    .from("client_social_daily_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .eq("platform", "facebook")
    .gte("snapshot_date", socialCutoff)
    .returns<SocialDailySnapshot[]>(), "Facebook daily numbers");

  // Reach counts people, so it can't be added up day by day; the 30-day figure
  // is captured on its own (client_social_period_metrics).
  const facebookPeriod = must(await admin
    .from("client_social_period_metrics")
    .select("reach, window_days")
    .eq("client_id", clientId)
    .eq("platform", "facebook")
    .maybeSingle<{ reach: number | null; window_days: number }>(), "Facebook reach");

  const defaultStart = adsSnapshot?.start_date ?? isoDateDaysAgo(30);
  const defaultEnd = adsSnapshot?.end_date ?? isoDateDaysAgo(0);
  const startDate = norm(userInput.startDate) || defaultStart;
  const endDate = norm(userInput.endDate) || defaultEnd;

  const activeServices = deriveActiveServices(clientRow);
  const ads = adsSnapshot ? toAdsMetrics(adsSnapshot) : null;

  const manual = userInput.gbpManual ?? {};
  const hasManualInteractions =
    manual.totalInteractions != null ||
    manual.phoneCalls != null ||
    manual.directionRequests != null ||
    manual.websiteClicks != null;

  const gbp: MarketingUpdateGbpMetrics | null = gbpSnapshot || hasManualInteractions
    ? {
        totalInteractions: manual.totalInteractions ?? null,
        phoneCalls: manual.phoneCalls ?? null,
        directionRequests: manual.directionRequests ?? null,
        websiteClicks: manual.websiteClicks ?? null,
        rating: gbpSnapshot?.rating ?? null,
        reviewCount: gbpSnapshot?.user_ratings_total ?? null,
        recentReviews30d: countRecentGbpReviews(gbpReviews ?? []),
        hasManualInteractions,
      }
    : null;

  const optionalChannels: MarketingUpdateOptionalChannel[] = [];
  const channelsIncluded: string[] = [];

  if (ads) {
    channelsIncluded.push("Google Ads");
  }

  if (gbp) {
    channelsIncluded.push("Google Business Profile");
  }

  if (latestGscSnapshot && gscDailyRows.length === 0) {
    unavailable.push("Search Console: the last sync has no day-by-day totals, so search numbers are left out.");
  }
  const gscClicks = gscDailyRows.reduce((sum, row) => sum + (Number(row.clicks) || 0), 0);
  const gscImpressions = gscDailyRows.reduce((sum, row) => sum + (Number(row.impressions) || 0), 0);
  if (gscClicks > 0 || gscImpressions > 0) {
    const ctr =
      gscImpressions > 0 ? ((gscClicks / gscImpressions) * 100).toFixed(2) : "0.00";
    optionalChannels.push({
      id: "search_console",
      label: "Search Console",
      summary: `${gscClicks.toLocaleString()} clicks, ${formatCompactNumber(gscImpressions)} impressions, ${ctr}% CTR (latest synced window).`,
    });
    channelsIncluded.push("Search Console");
  }

  const fbEngagement = (socialRows ?? []).reduce((sum, row) => sum + (row.engagement ?? 0), 0);
  const fbReach = typeof facebookPeriod?.reach === "number" ? facebookPeriod.reach : null;
  if (fbEngagement > 0 || (fbReach ?? 0) > 0) {
    const reachPart =
      fbReach != null ? ` and ${formatCompactNumber(fbReach)} people reached over the last ${facebookPeriod!.window_days} days` : "";
    optionalChannels.push({
      id: "facebook",
      label: "Facebook",
      summary: `${fbEngagement.toLocaleString()} engagements over the last 30 days${reachPart}.`,
    });
    channelsIncluded.push("Facebook");
  }

  const keywordHighlights = await loadKeywordHighlights(clientRow, unavailable);
  if (keywordHighlights.length > 0) {
    optionalChannels.push({
      id: "keywords",
      label: "Keyword movement",
      summary: keywordHighlights.join("; "),
    });
    channelsIncluded.push("Keywords");
  }

  return {
    client: {
      id: clientRow.id,
      accountName: clientRow.account_name,
      marketingStrategist: clientRow.marketing_strategist,
      websiteLabel: websiteLabel(clientRow.website),
      activeServices,
    },
    title: norm(userInput.title) || defaultMarketingUpdateTitle(),
    greeting: norm(userInput.greeting) || defaultMarketingUpdateGreeting(clientRow.account_name),
    window: {
      startDate,
      endDate,
      dateRangeLabel: formatDateRangeLabel(startDate, endDate),
    },
    ads,
    gbp,
    optionalChannels,
    workInProgressHints: deriveWorkInProgressHints(activeServices),
    clientRequests: norm(userInput.clientRequests) || null,
    nextMeetingUrl: norm(userInput.nextMeetingUrl) || null,
    additionalNotes: norm(userInput.additionalNotes) || null,
    channelsIncluded,
    unavailable,
  };
}
