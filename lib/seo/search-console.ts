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

export type GscDailyRow = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscSitemapEntry = {
  sitemapUrl: string;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  isPending: boolean;
  isSitemapsIndex: boolean;
  errors: number;
  warnings: number;
  urlsSubmitted: number;
  urlsIndexed: number;
};

export type GscSyncResult = {
  propertyUrl: string;
  startDate: string;
  endDate: string;
  pageRows: GscMetricRow[];
  queryRows: GscMetricRow[];
  dailyRows: GscDailyRow[];
  sitemaps: GscSitemapEntry[];
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

type SitemapsListResponse = {
  sitemap?: Array<{
    path?: string;
    lastSubmitted?: string;
    lastDownloaded?: string;
    isPending?: boolean;
    isSitemapsIndex?: boolean;
    errors?: string;
    warnings?: string;
    contents?: Array<{
      type?: string;
      submitted?: string;
      indexed?: string;
    }>;
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
  rowLimit = 25,
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

async function fetchDailyTrend(
  accessToken: string,
  propertyUrl: string,
  startDate: string,
  endDate: string,
): Promise<GscDailyRow[]> {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, dimensions: ["date"], rowLimit: 90 }),
    cache: "no-store",
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as SearchAnalyticsResponse;
  return (payload.rows ?? [])
    .map((row) => {
      const date = (row.keys?.[0] ?? "").trim();
      if (!date) return null;
      return {
        date,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      };
    })
    .filter((r): r is GscDailyRow => r != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchSitemaps(
  accessToken: string,
  propertyUrl: string,
): Promise<GscSitemapEntry[]> {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/sitemaps`;
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as SitemapsListResponse;
  return (payload.sitemap ?? [])
    .map((s) => {
      const webContent = s.contents?.find((c) => c.type === "web") ?? s.contents?.[0];
      return {
        sitemapUrl: s.path ?? "",
        lastSubmitted: s.lastSubmitted ?? null,
        lastDownloaded: s.lastDownloaded ?? null,
        isPending: s.isPending ?? false,
        isSitemapsIndex: s.isSitemapsIndex ?? false,
        errors: parseInt(s.errors ?? "0", 10) || 0,
        warnings: parseInt(s.warnings ?? "0", 10) || 0,
        urlsSubmitted: parseInt(webContent?.submitted ?? "0", 10) || 0,
        urlsIndexed: parseInt(webContent?.indexed ?? "0", 10) || 0,
      };
    })
    .filter((s) => s.sitemapUrl);
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
  userAccessToken?: string,
): Promise<GscSyncResult> {
  const requestedPropertyUrl = normalizePropertyUrl(rawPropertyUrl, fallbackWebsite);
  if (!requestedPropertyUrl) {
    throw new Error("Search Console property URL is required.");
  }
  const accessToken = userAccessToken ?? await getAccessToken();
  const siteEntries = await listAccessibleSites(accessToken);
  const propertyUrl = resolvePreferredProperty(requestedPropertyUrl, siteEntries);

  const [pageRows, queryRows, dailyRows, sitemaps] = await Promise.all([
    fetchSearchAnalytics(accessToken, propertyUrl, startDate, endDate, "page"),
    fetchSearchAnalytics(accessToken, propertyUrl, startDate, endDate, "query", 100),
    fetchDailyTrend(accessToken, propertyUrl, startDate, endDate),
    fetchSitemaps(accessToken, propertyUrl).catch(() => [] as GscSitemapEntry[]),
  ]);
  return {
    propertyUrl,
    startDate,
    endDate,
    pageRows,
    queryRows,
    dailyRows,
    sitemaps,
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
