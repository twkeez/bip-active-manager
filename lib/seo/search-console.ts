import { JWT, OAuth2Client } from "google-auth-library";
import {
  getGoogleOAuthRefreshConfig,
  getGoogleServiceAccountConfig,
} from "@/lib/env";

export type GscMetricRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscSyncResult = {
  propertyUrl: string;
  startDate: string;
  endDate: string;
  pageRows: GscMetricRow[];
  queryRows: GscMetricRow[];
};

export type GscKeywordPageRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscKeywordHealthResult = {
  propertyUrl: string;
  currentStartDate: string;
  currentEndDate: string;
  previousStartDate: string;
  previousEndDate: string;
  currentRows: GscKeywordPageRow[];
  previousRows: GscKeywordPageRow[];
};

type SearchAnalyticsResponse = {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
};

type SitesListResponse = {
  siteEntry?: Array<{
    siteUrl?: string;
    permissionLevel?: string;
  }>;
};

const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function normalizePropertyUrl(rawPropertyUrl: string, fallbackWebsite: string) {
  const fromClient = rawPropertyUrl.trim();
  if (fromClient) return fromClient;
  const website = fallbackWebsite.trim();
  if (!website) return "";
  if (website.startsWith("sc-domain:")) return website;
  if (website.includes("://")) return website;
  return `https://${website}`;
}

async function getAccessToken() {
  const oauthConfig = getGoogleOAuthRefreshConfig();
  let tokenResponse: string | { token?: string | null } | null;

  if (oauthConfig) {
    const oauth = new OAuth2Client(
      oauthConfig.clientId,
      oauthConfig.clientSecret,
      oauthConfig.redirectUri,
    );
    oauth.setCredentials({ refresh_token: oauthConfig.refreshToken });
    tokenResponse = await oauth.getAccessToken();
  } else {
    const { clientEmail, privateKey } = getGoogleServiceAccountConfig();
    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [SEARCH_CONSOLE_SCOPE],
    });
    tokenResponse = await auth.getAccessToken();
  }

  const token =
    typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token ?? null;
  if (!token) throw new Error("Failed to acquire Google access token.");
  return token;
}

async function fetchSearchAnalytics(
  accessToken: string,
  propertyUrl: string,
  startDate: string,
  endDate: string,
  dimension: "page" | "query",
): Promise<GscMetricRow[]> {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: [dimension],
      rowLimit: 25,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Search Console API failed (${response.status}): ${bodyText}`);
  }
  const payload = (await response.json()) as SearchAnalyticsResponse;
  return (payload.rows ?? [])
    .map((row) => {
      const key = (row.keys?.[0] ?? "").trim();
      if (!key) return null;
      return {
        key,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      };
    })
    .filter((row): row is GscMetricRow => row != null);
}

async function fetchSearchAnalyticsByQueryAndPage(
  accessToken: string,
  propertyUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number,
): Promise<GscKeywordPageRow[]> {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Search Console API failed (${response.status}): ${bodyText}`);
  }
  const payload = (await response.json()) as SearchAnalyticsResponse;
  return (payload.rows ?? [])
    .map((row) => {
      const query = (row.keys?.[0] ?? "").trim();
      const page = (row.keys?.[1] ?? "").trim();
      if (!query || !page) return null;
      return {
        query,
        page,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      };
    })
    .filter((row): row is GscKeywordPageRow => row != null);
}

async function listAccessibleSites(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as SitesListResponse;
  return (payload.siteEntry ?? []).map((entry) => ({
    siteUrl: (entry.siteUrl ?? "").trim(),
    permissionLevel: (entry.permissionLevel ?? "").trim(),
  }));
}

function isStrongPermission(permissionLevel: string) {
  return permissionLevel === "siteOwner" || permissionLevel === "siteFullUser";
}

function parseUrlHost(value: string) {
  if (!value || value.startsWith("sc-domain:")) return null;
  try {
    const normalized = value.includes("://") ? value : `https://${value}`;
    const url = new URL(normalized);
    const host = url.host.toLowerCase();
    return { host, hostNoWww: host.replace(/^www\./, "") };
  } catch {
    return null;
  }
}

function resolvePreferredProperty(requestedProperty: string, siteEntries: Array<{
  siteUrl: string;
  permissionLevel: string;
}>) {
  const strong = siteEntries.filter((site) =>
    isStrongPermission(site.permissionLevel),
  );
  if (strong.some((site) => site.siteUrl === requestedProperty)) {
    return requestedProperty;
  }

  const requestedHost = parseUrlHost(requestedProperty);
  if (!requestedHost) return requestedProperty;

  const strongUrlPrefix = strong.filter((site) => !site.siteUrl.startsWith("sc-domain:"));
  const exactHost = strongUrlPrefix.find((site) => {
    const host = parseUrlHost(site.siteUrl);
    return host?.host === requestedHost.host;
  });
  if (exactHost) return exactHost.siteUrl;

  const hostNoWwwMatch = strongUrlPrefix.find((site) => {
    const host = parseUrlHost(site.siteUrl);
    return host?.hostNoWww === requestedHost.hostNoWww;
  });
  if (hostNoWwwMatch) return hostNoWwwMatch.siteUrl;

  const strongDomain = strong.find(
    (site) =>
      site.siteUrl.startsWith("sc-domain:") &&
      requestedHost.hostNoWww.endsWith(
        site.siteUrl.slice("sc-domain:".length).toLowerCase(),
      ),
  );
  if (strongDomain) return strongDomain.siteUrl;

  return requestedProperty;
}

export async function runSearchConsoleSync(
  rawPropertyUrl: string,
  fallbackWebsite: string,
  startDate: string,
  endDate: string,
): Promise<GscSyncResult> {
  const requestedPropertyUrl = normalizePropertyUrl(rawPropertyUrl, fallbackWebsite);
  if (!requestedPropertyUrl) {
    throw new Error("Search Console property URL is required.");
  }
  const accessToken = await getAccessToken();
  const siteEntries = await listAccessibleSites(accessToken);
  const propertyUrl = resolvePreferredProperty(requestedPropertyUrl, siteEntries);

  const [pageRows, queryRows] = await Promise.all([
    fetchSearchAnalytics(accessToken, propertyUrl, startDate, endDate, "page"),
    fetchSearchAnalytics(accessToken, propertyUrl, startDate, endDate, "query"),
  ]);
  return {
    propertyUrl,
    startDate,
    endDate,
    pageRows,
    queryRows,
  };
}

function isoDateDaysAgo(days: number) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export async function runKeywordHealthComparison(
  rawPropertyUrl: string,
  fallbackWebsite: string,
): Promise<GscKeywordHealthResult> {
  const requestedPropertyUrl = normalizePropertyUrl(rawPropertyUrl, fallbackWebsite);
  if (!requestedPropertyUrl) {
    throw new Error("Search Console property URL is required.");
  }
  const accessToken = await getAccessToken();
  const siteEntries = await listAccessibleSites(accessToken);
  const propertyUrl = resolvePreferredProperty(requestedPropertyUrl, siteEntries);

  const currentStartDate = isoDateDaysAgo(7);
  const currentEndDate = isoDateDaysAgo(1);
  const previousStartDate = isoDateDaysAgo(14);
  const previousEndDate = isoDateDaysAgo(8);

  const [currentRows, previousRows] = await Promise.all([
    fetchSearchAnalyticsByQueryAndPage(
      accessToken,
      propertyUrl,
      currentStartDate,
      currentEndDate,
      120,
    ),
    fetchSearchAnalyticsByQueryAndPage(
      accessToken,
      propertyUrl,
      previousStartDate,
      previousEndDate,
      120,
    ),
  ]);

  return {
    propertyUrl,
    currentStartDate,
    currentEndDate,
    previousStartDate,
    previousEndDate,
    currentRows,
    previousRows,
  };
}
