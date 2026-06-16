import { OAuth2Client } from "google-auth-library";
import { assertValidCustomerId, normalizeCustomerId } from "@/lib/ads/customer-id";
import { getGoogleAdsConfig, getGoogleOAuthRefreshConfig } from "@/lib/env";

export type GoogleAdsStreamRow = {
  campaign?: {
    id?: string;
    name?: string;
    advertisingChannelType?: string;
    biddingStrategyType?: string;
  };
  adGroup?: { id?: string; name?: string };
  adGroupCriterion?: {
    criterionId?: string;
    keyword?: { text?: string; matchType?: string };
    qualityInfo?: {
      qualityScore?: number;
      creativeQualityScore?: string;
      postClickQualityScore?: string;
      searchPredictedCtr?: string;
    };
  };
  searchTermView?: { searchTerm?: string };
  geographicView?: {
    countryCriterionId?: string;
    resourceName?: string;
    locationType?: string;
  };
  conversionAction?: {
    name?: string;
    type?: string;
    category?: string;
    countingType?: string;
    status?: string;
  };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    conversions?: number;
    ctr?: number;
    averageCpc?: string;
    searchImpressionShare?: number;
    searchRankLostImpressionShare?: number;
    searchBudgetLostImpressionShare?: number;
    auctionInsightSearchImpressionShare?: number;
    auctionInsightSearchOverlapRate?: number;
    auctionInsightSearchPositionAboveRate?: number;
    auctionInsightSearchTopOfPageRate?: number;
    auctionInsightSearchOutrankingShare?: number;
  };
  segments?: {
    auctionInsightDomain?: string;
    device?: string;
    dayOfWeek?: string;
    hour?: number;
    keyword?: { info?: { text?: string } };
  };
};

type GoogleAdsStreamChunk = {
  results?: GoogleAdsStreamRow[];
};

export type SearchStreamContext = {
  endpoint: string;
  accessToken: string;
  developerToken: string;
  loginCustomerId?: string;
};

function summarizeGoogleAdsErrorBody(bodyText: string) {
  const normalized = bodyText.trim();
  if (!normalized) return "No response body returned.";
  if (normalized.startsWith("<!DOCTYPE html")) {
    return "Received HTML 404 response. This usually means the customer ID is invalid or malformed.";
  }
  return normalized.length > 500 ? `${normalized.slice(0, 500)}…` : normalized;
}

export async function searchStream<T>(
  ctx: SearchStreamContext,
  query: string,
  mapRow: (row: GoogleAdsStreamRow) => T | null,
): Promise<T[]> {
  const response = await fetch(ctx.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      "developer-token": ctx.developerToken,
      ...(ctx.loginCustomerId ? { "login-customer-id": ctx.loginCustomerId } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Google Ads API failed (${response.status}): ${summarizeGoogleAdsErrorBody(bodyText)}`,
    );
  }
  const chunks = (await response.json()) as GoogleAdsStreamChunk[];
  const rows: T[] = [];
  for (const chunk of chunks) {
    for (const row of chunk.results ?? []) {
      const mapped = mapRow(row);
      if (mapped != null) rows.push(mapped);
    }
  }
  return rows;
}

export async function getGoogleAccessToken() {
  const oauthConfig = getGoogleOAuthRefreshConfig();
  if (!oauthConfig) {
    throw new Error(
      "Missing Google OAuth refresh credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.",
    );
  }
  const oauth = new OAuth2Client(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    oauthConfig.redirectUri,
  );
  oauth.setCredentials({ refresh_token: oauthConfig.refreshToken });
  const tokenResponse = await oauth.getAccessToken();
  const token =
    typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token ?? null;
  if (!token) {
    throw new Error("Failed to acquire Google OAuth access token for Google Ads.");
  }
  return token;
}

export { assertValidCustomerId, normalizeCustomerId } from "@/lib/ads/customer-id";

export async function createSearchStreamContext(rawCustomerId: string) {
  const customerId = normalizeCustomerId(rawCustomerId);
  assertValidCustomerId(customerId, "Google Ads customer ID");
  const accessToken = await getGoogleAccessToken();
  const { developerToken, loginCustomerId, apiVersion } = getGoogleAdsConfig();
  const normalizedLoginCustomerId = normalizeCustomerId(loginCustomerId);
  if (normalizedLoginCustomerId) {
    assertValidCustomerId(normalizedLoginCustomerId, "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  }
  return {
    customerId,
    apiVersion,
    ctx: {
      endpoint: `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:searchStream`,
      accessToken,
      developerToken,
      loginCustomerId: normalizedLoginCustomerId || undefined,
    } satisfies SearchStreamContext,
  };
}
