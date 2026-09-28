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
  /** Null = the report failed (not retrieved), which is different from an empty list. */
  conversionsByEvent: Ga4ConversionRow[] | null;
  geoBreakdown: Ga4GeoRow[] | null;
  deviceBreakdown: Ga4DeviceRow[] | null;
  sourceMediumBreakdown: Ga4SourceMediumRow[] | null;
  newVsReturning: Ga4NewVsReturningRow[] | null;
  sessionsTrend: Ga4TrendPoint[] | null;
  landingPages: Ga4LandingPageRow[] | null;
  /** Optional reports that failed after retries, with the reason. */
  failedReports: string[];
};

async function getServiceAccountToken(): Promise<string> {
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
  /** Return rows for date ranges with no data, instead of leaving them out. */
  keepEmptyRows?: boolean;
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
  // GA4 answers 429 (quota) and brief 5xx under load; retry those before
  // giving up, so a busy minute is not recorded as a failed report.
  let res: Response;
  let json: Ga4ReportResponse;
  for (let attempt = 0; ; attempt += 1) {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    json = (await res.json().catch(() => ({}))) as Ga4ReportResponse;
    if (![429, 500, 502, 503, 504].includes(res.status) || attempt >= 2) break;
    await new Promise((resolve) => setTimeout(resolve, 1500 * 2 ** attempt));
  }
  if (!res.ok) {
    let msg = `GA4 API error (${res.status}): ${json.error?.message ?? res.statusText}`;
    if (res.status === 403) {
      const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL ?? "";
      msg += svcEmail
        ? ` — Add ${svcEmail} as a Viewer in GA4 → Admin → Property access management, then test again.`
        : ` — Grant the BIP service account Viewer access in GA4 → Admin → Property access management, then test again.`;
    }
    throw new Error(msg);
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

/**
 * Runs an optional report. A failure no longer breaks the whole sync, but it
 * is no longer disguised either: it used to come back as "no rows", stored as
 * zeros and empty lists that read as a quiet month (found 2026-09-28). Now it
 * returns null, which is stored as "not retrieved", and the failure is
 * recorded so the snapshot and the nightly job can say so.
 */
async function safeReport(
  propertyId: string,
  token: string,
  body: Ga4RunReportBody,
  label: string,
  failures: string[],
): Promise<Ga4ReportResponse | null> {
  try {
    return await runReport(propertyId, token, body);
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : "failed"}`);
    return null;
  }
}

/**
 * The row for a named date range. With several ranges GA4 adds a dateRange
 * dimension to each row, and it leaves out a range with no data unless
 * keepEmptyRows is set, so reading rows by position could show last period's
 * numbers as this period's exactly when tracking broke.
 */
function rowForRange(report: Ga4ReportResponse | null, name: string): Ga4Row | undefined {
  const rows = report?.rows ?? [];
  const named = rows.find((row) => row.dimensionValues?.some((value) => value.value === name));
  if (named) return named;
  // No dateRange dimension came back: fall back to position (current first).
  const hasNames = rows.some((row) => (row.dimensionValues ?? []).length > 0);
  return hasNames ? undefined : rows[name === "current" ? 0 : 1];
}

export async function runGa4Sync(
  rawPropertyId: string,
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
  userAccessToken?: string,
): Promise<Ga4SyncResult> {
  // Strip "properties/" prefix if present — we store just the numeric ID
  const propertyId = rawPropertyId.replace(/^properties\//, "");

  const token = userAccessToken ?? await getServiceAccountToken();

  const failures: string[] = [];
  const { totals: currentTotals, previousTotals } = await fetchGa4PeriodTotals(
    propertyId,
    token,
    { startDate, endDate, prevStartDate, prevEndDate },
    failures,
  );

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
  }, "conversions by event", failures);
  const conversionsByEvent: Ga4ConversionRow[] | null = conversionsReport === null ? null : (conversionsReport.rows ?? [])
    .map((row) => ({ event_name: dim(row, 0), conversions: num(row, 0) }))
    .filter((r) => r.conversions > 0);

  // Geography (city + region) by sessions.
  const geoReport = await safeReport(propertyId, token, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "city" }, { name: "region" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }],
    limit: 15,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  }, "geography", failures);
  const geoBreakdown: Ga4GeoRow[] | null = geoReport === null ? null : (geoReport.rows ?? []).map((row) => ({
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
  }, "devices", failures);
  const deviceBreakdown: Ga4DeviceRow[] | null = deviceReport === null ? null : (deviceReport.rows ?? []).map((row) => ({
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
  }, "source / medium", failures);
  const sourceMediumBreakdown: Ga4SourceMediumRow[] | null = sourceMediumReport === null ? null : (sourceMediumReport.rows ?? []).map((row) => ({
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
  }, "new vs returning", failures);
  const newVsReturning: Ga4NewVsReturningRow[] | null = nvrReport === null ? null : (nvrReport.rows ?? []).map((row) => ({
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
  }, "sessions trend", failures);
  const sessionsTrend: Ga4TrendPoint[] | null = trendReport === null ? null : (trendReport.rows ?? []).map((row) => {
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
  }, "landing pages", failures);
  const landingPages: Ga4LandingPageRow[] | null = landingReport === null ? null : (landingReport.rows ?? []).map((row) => ({
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
    failedReports: failures,
  };
}

/** Engagement-quality fields left empty (not zero) when their report failed. */
function withoutQualityIfFailed(totals: Ga4Totals, qualityReport: Ga4ReportResponse | null): Ga4Totals {
  if (qualityReport !== null) return totals;
  return {
    ...totals,
    engaged_sessions: null,
    bounce_rate: null,
    avg_session_duration_seconds: null,
    views_per_session: null,
    events_per_session: null,
    session_key_event_rate: null,
  } as unknown as Ga4Totals;
}

/**
 * Current and previous period totals, each read by its range name. Exported
 * so stored snapshots can be corrected with exactly the logic the nightly
 * sync uses.
 */
export async function fetchGa4PeriodTotals(
  propertyId: string,
  token: string,
  window: { startDate: string; endDate: string; prevStartDate: string; prevEndDate: string },
  failures: string[],
): Promise<{ totals: Ga4Totals; previousTotals: Ga4Totals }> {
  const { startDate, endDate, prevStartDate, prevEndDate } = window;
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
    keepEmptyRows: true,
  });

  // Engagement-quality metrics in a second request (GA4 caps one request at 10
  // metrics). If it fails, those fields are left empty, not zero.
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
    keepEmptyRows: true,
  }, "engagement quality", failures);

  const currentTotals = withoutQualityIfFailed(
    parseTotalsRow(rowForRange(totalsReport, "current"), rowForRange(qualityReport, "current")),
    qualityReport,
  );
  const previousTotals = withoutQualityIfFailed(
    parseTotalsRow(rowForRange(totalsReport, "previous"), rowForRange(qualityReport, "previous")),
    qualityReport,
  );

  return { totals: currentTotals, previousTotals };
}

export async function getGa4ServiceToken(): Promise<string> {
  return getServiceAccountToken();
}
