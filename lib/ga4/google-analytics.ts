import { JWT } from "google-auth-library";
import { getGoogleServiceAccountConfig } from "@/lib/env";
import type {
  Ga4ChannelRow,
  Ga4ConversionRow,
  Ga4DeviceRow,
  Ga4GeoRow,
  Ga4LandingPageRow,
  Ga4NewVsReturningRow,
  Ga4PageRow,
  Ga4SourceMediumRow,
  Ga4Totals,
  Ga4TrendPoint,
} from "@/lib/types/client";

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GA4_BASE = "https://analyticsdata.googleapis.com/v1beta";

export type Ga4SyncResult = {
  propertyId: string;
  startDate: string;
  endDate: string;
  totals: Ga4Totals;
  previousTotals: Ga4Totals;
  channelBreakdown: Ga4ChannelRow[];
  topPages: Ga4PageRow[];
  conversionsByEvent: Ga4ConversionRow[];
  geoBreakdown: Ga4GeoRow[];
  deviceBreakdown: Ga4DeviceRow[];
  sourceMediumBreakdown: Ga4SourceMediumRow[];
  newVsReturning: Ga4NewVsReturningRow[];
  sessionsTrend: Ga4TrendPoint[];
  landingPages: Ga4LandingPageRow[];
};

async function getAccessToken(): Promise<string> {
  const { clientEmail, privateKey } = getGoogleServiceAccountConfig();
  const auth = new JWT({ email: clientEmail, key: privateKey, scopes: [GA4_SCOPE] });
  const token = await auth.getAccessToken();
  const t = typeof token === "string" ? token : token?.token;
  if (!t) throw new Error("Failed to acquire GA4 access token.");
  return t;
}

type Ga4RunReportBody = {
  dateRanges: Array<{ startDate: string; endDate: string; name?: string }>;
  dimensions?: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  limit?: number;
  orderBys?: Array<{
    metric?: { metricName: string };
    dimension?: { dimensionName: string };
    desc?: boolean;
  }>;
};

type Ga4Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type Ga4ReportResponse = {
  rows?: Ga4Row[];
  totals?: Ga4Row[];
  error?: { message?: string; code?: number };
};

async function runReport(
  propertyId: string,
  token: string,
  body: Ga4RunReportBody,
): Promise<Ga4ReportResponse> {
  const url = `${GA4_BASE}/properties/${propertyId}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as Ga4ReportResponse;
  if (!res.ok) {
    throw new Error(`GA4 API error (${res.status}): ${json.error?.message ?? res.statusText}`);
  }
  return json;
}

function num(row: Ga4Row | undefined, index: number): number {
  const v = row?.metricValues?.[index]?.value;
  return v ? Number(v) : 0;
}

function dim(row: Ga4Row, index: number): string {
  return row.dimensionValues?.[index]?.value ?? "";
}

function parseTotalsRow(
  core: Ga4Row | undefined,
  quality: Ga4Row | undefined,
): Ga4Totals {
  const sessions = num(core, 0);
  // GA4 returns userEngagementDuration (total seconds). Average engagement time
  // per session = total ÷ sessions.
  const totalEngagementSeconds = num(core, 4);
  const conversions = num(core, 5);
  return {
    sessions,
    users: num(core, 1),
    new_users: num(core, 2),
    engagement_rate: num(core, 3),
    avg_engagement_time_seconds: sessions > 0 ? totalEngagementSeconds / sessions : 0,
    conversions,
    // From the second (engagement-quality) request.
    engaged_sessions: num(quality, 0),
    bounce_rate: num(quality, 1),
    avg_session_duration_seconds: num(quality, 2),
    views_per_session: num(quality, 3),
    events_per_session: num(quality, 4),
    session_key_event_rate: sessions > 0 ? conversions / sessions : 0,
  };
}

/** Runs a report and returns a fallback on failure, so an unsupported metric or
 *  dimension on a given property never breaks the whole sync. */
async function safeReport(
  propertyId: string,
  token: string,
  body: Ga4RunReportBody,
): Promise<Ga4ReportResponse> {
  try {
    return await runReport(propertyId, token, body);
  } catch {
    return { rows: [] };
  }
}

export async function runGa4Sync(
  rawPropertyId: string,
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
): Promise<Ga4SyncResult> {
  // Strip "properties/" prefix if present — we store just the numeric ID
  const propertyId = rawPropertyId.replace(/^properties\//, "");

  const token = await getAccessToken();

  // Totals for current + previous period in one request (two date ranges)
  const totalsReport = await runReport(propertyId, token, {
    dateRanges: [
      { startDate, endDate, name: "current" },
      { startDate: prevStartDate, endDate: prevEndDate, name: "previous" },
    ],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "newUsers" },
      { name: "engagementRate" },
      { name: "userEngagementDuration" },
      { name: "conversions" },
    ],
    // returnPropertyQuota: true — not needed here
  });

  // Engagement-quality metrics in a second request (GA4 caps one request at 10
  // metrics). safeReport so an unsupported metric just yields zeros.
  const qualityReport = await safeReport(propertyId, token, {
    dateRanges: [
      { startDate, endDate, name: "current" },
      { startDate: prevStartDate, endDate: prevEndDate, name: "previous" },
    ],
    metrics: [
      { name: "engagedSessions" },
      { name: "bounceRate" },
      { name: "averageSessionDuration" },
      { name: "screenPageViewsPerSession" },
      { name: "eventsPerSession" },
    ],
  });

  // With two date ranges and no dimensions, the API returns two rows (one per range)
  const currentTotals = parseTotalsRow(totalsReport.rows?.[0], qualityReport.rows?.[0]);
  const previousTotals = parseTotalsRow(totalsReport.rows?.[1], qualityReport.rows?.[1]);

  // Channel breakdown (current period only)
  const channelReport = await runReport(propertyId, token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "engagementRate" }],
    limit: 20,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  const channelBreakdown: Ga4ChannelRow[] = (channelReport.rows ?? []).map((row) => ({
    channel: dim(row, 0),
    sessions: num(row, 0),
    users: num(row, 1),
    engagement_rate: num(row, 2),
  }));

  // Top pages by sessions (current period only)
  const pagesReport = await runReport(propertyId, token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    metrics: [
      { name: "sessions" },
      { name: "engagementRate" },
      { name: "userEngagementDuration" },
    ],
    limit: 25,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  const topPages: Ga4PageRow[] = (pagesReport.rows ?? []).map((row) => {
    const pageSessions = num(row, 0);
    const pageEngagementSeconds = num(row, 2); // total userEngagementDuration
    return {
      page_path: dim(row, 0),
      sessions: pageSessions,
      engagement_rate: num(row, 1),
      avg_engagement_time_seconds: pageSessions > 0 ? pageEngagementSeconds / pageSessions : 0,
    };
  });

  // Conversions by key event (the "what converted" breakdown).
  const conversionsReport = await safeReport(propertyId, token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "conversions" }],
    limit: 25,
    orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
  });
  const conversionsByEvent: Ga4ConversionRow[] = (conversionsReport.rows ?? [])
    .map((row) => ({ event_name: dim(row, 0), conversions: num(row, 0) }))
    .filter((r) => r.conversions > 0);

  // Geography (city + region) by sessions.
  const geoReport = await safeReport(propertyId, token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "city" }, { name: "region" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }],
    limit: 15,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });
  const geoBreakdown: Ga4GeoRow[] = (geoReport.rows ?? []).map((row) => ({
    city: dim(row, 0),
    region: dim(row, 1),
    sessions: num(row, 0),
    users: num(row, 1),
  }));

  // Device category.
  const deviceReport = await safeReport(propertyId, token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "deviceCategory" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }],
    limit: 10,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });
  const deviceBreakdown: Ga4DeviceRow[] = (deviceReport.rows ?? []).map((row) => ({
    device: dim(row, 0),
    sessions: num(row, 0),
    engagement_rate: num(row, 1),
  }));

  // Source / medium (finer than channel group).
  const sourceMediumReport = await safeReport(propertyId, token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionSourceMedium" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }],
    limit: 15,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });
  const sourceMediumBreakdown: Ga4SourceMediumRow[] = (sourceMediumReport.rows ?? []).map((row) => ({
    source_medium: dim(row, 0),
    sessions: num(row, 0),
    conversions: num(row, 1),
  }));

  // New vs returning.
  const nvrReport = await safeReport(propertyId, token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "newVsReturning" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }],
    limit: 5,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });
  const newVsReturning: Ga4NewVsReturningRow[] = (nvrReport.rows ?? []).map((row) => ({
    cohort: dim(row, 0) || "(unknown)",
    sessions: num(row, 0),
    users: num(row, 1),
  }));

  // Sessions trend by date (for the line chart).
  const trendReport = await safeReport(propertyId, token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }],
    limit: 60,
    orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
  });
  const sessionsTrend: Ga4TrendPoint[] = (trendReport.rows ?? []).map((row) => {
    const raw = dim(row, 0); // YYYYMMDD
    const date =
      raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
    return { date, sessions: num(row, 0) };
  });

  // Landing pages (entry points).
  const landingReport = await safeReport(propertyId, token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "landingPage" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }],
    limit: 15,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });
  const landingPages: Ga4LandingPageRow[] = (landingReport.rows ?? []).map((row) => ({
    landing_page: dim(row, 0),
    sessions: num(row, 0),
    engagement_rate: num(row, 1),
  }));

  return {
    propertyId,
    startDate,
    endDate,
    totals: currentTotals,
    previousTotals,
    channelBreakdown,
    topPages,
    conversionsByEvent,
    geoBreakdown,
    deviceBreakdown,
    sourceMediumBreakdown,
    newVsReturning,
    sessionsTrend,
    landingPages,
  };
}
