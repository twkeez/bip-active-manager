import { JWT } from "google-auth-library";
import { getGoogleServiceAccountConfig } from "@/lib/env";
import type { Ga4ChannelRow, Ga4PageRow, Ga4Totals } from "@/lib/types/client";

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
  orderBys?: Array<{ metric?: { metricName: string }; desc?: boolean }>;
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

function parseTotalsRow(row: Ga4Row | undefined): Ga4Totals {
  return {
    sessions: num(row, 0),
    users: num(row, 1),
    new_users: num(row, 2),
    engagement_rate: num(row, 3),
    avg_engagement_time_seconds: num(row, 4),
    conversions: num(row, 5),
  };
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

  // With two date ranges and no dimensions, the API returns two rows (one per range)
  const currentTotals = parseTotalsRow(totalsReport.rows?.[0]);
  const previousTotals = parseTotalsRow(totalsReport.rows?.[1]);

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

  const topPages: Ga4PageRow[] = (pagesReport.rows ?? []).map((row) => ({
    page_path: dim(row, 0),
    sessions: num(row, 0),
    engagement_rate: num(row, 1),
    avg_engagement_time_seconds: num(row, 2),
  }));

  return {
    propertyId,
    startDate,
    endDate,
    totals: currentTotals,
    previousTotals,
    channelBreakdown,
    topPages,
  };
}
