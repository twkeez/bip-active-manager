import { OAuth2Client } from "google-auth-library";
import { getGoogleOAuthRefreshConfig } from "@/lib/env";
import { getGmailAccessTokenForUser } from "@/lib/gmail/token-manager";
import { getGoogleAccessTokenForScope } from "@/lib/google/token-manager";
import { createAdminClient } from "@/lib/supabase/admin";

export type GbpProfileFields = {
  phone: boolean;
  hours: boolean;
  description: boolean;
  categories: boolean;
  website: boolean;
};

export type GbpSyncResult = {
  placeId: string;
  placeName: string | null;
  profileUrl: string | null;
  websiteUrl: string | null;
  address: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  lastPostAt: string | null;
  profileFields: GbpProfileFields | null;
  reviews: Array<{
    authorName: string | null;
    rating: number | null;
    text: string | null;
    relativeTimeDescription: string | null;
    reviewTimeUnix: number | null;
  }>;
  diagnostics?: {
    placesReviewCount: number;
    legacyReviewCount: number;
    gbpApiReviewCount: number;
    matchedGbpLocationCount: number;
    gbpApiError: string | null;
  };
};

type NormalizedReview = GbpSyncResult["reviews"][number];

type PlacesApiReview = {
  authorAttribution?: { displayName?: string };
  rating?: number;
  text?: { text?: string };
  relativePublishTimeDescription?: string;
  publishTime?: string;
};

type PlacesApiResponse = {
  id?: string;
  displayName?: { text?: string };
  googleMapsUri?: string;
  websiteUri?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: PlacesApiReview[];
};

type GbpAccountManagementResponse = {
  accounts?: Array<{ name?: string; accountName?: string }>;
};

type GbpBusinessInfoLocationsResponse = {
  locations?: Array<{
    name?: string;
    title?: string;
    metadata?: { placeId?: string };
  }>;
  nextPageToken?: string;
};

type GbpReviewsResponse = {
  reviews?: Array<{
    reviewer?: { displayName?: string };
    starRating?: string;
    comment?: string;
    createTime?: string;
    updateTime?: string;
  }>;
};

type GbpLocalPostsResponse = {
  localPosts?: Array<{ createTime?: string; updateTime?: string }>;
};

type GbpBusinessInfoResponse = {
  phoneNumbers?: { primaryPhone?: string };
  categories?: { primaryCategory?: { displayName?: string } };
  regularHours?: { periods?: Array<unknown> };
  profile?: { description?: string };
  websiteUri?: string;
};

function isRetriableGbpError(status: number, message: string) {
  if (status === 429) return true;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("quota exceeded") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  );
}

async function fetchJsonWithRetry<T>(
  input: string | URL,
  init: RequestInit,
  options: { label: string; retries?: number; baseDelayMs?: number } = { label: "request" },
): Promise<T> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 600;
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    const response = await fetch(input, init);
    const payload = (await response.json()) as T & { error?: { message?: string } };
    if (response.ok) return payload as T;

    const message =
      payload?.error?.message ??
      `${options.label} failed (${response.status})`;
    if (attempt >= retries || !isRetriableGbpError(response.status, message)) {
      throw new Error(message);
    }

    lastError = new Error(message);
    const delayMs = baseDelayMs * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    attempt += 1;
  }

  throw lastError ?? new Error(`${options.label} failed`);
}

type LegacyPlaceDetailsResponse = {
  status?: string;
  error_message?: string;
  result?: {
    reviews?: Array<{
      author_name?: string;
      rating?: number;
      text?: string;
      relative_time_description?: string;
      time?: number;
    }>;
  };
};

async function gmailTokenWithScope(
  admin: ReturnType<typeof createAdminClient>,
  scope: string,
): Promise<string | null> {
  const { data } = await admin
    .from("integration_api_tokens")
    .select("token_type, metadata")
    .eq("provider", "gmail");
  const row = (data ?? []).find((r) => String((r.metadata as { scope?: string } | null)?.scope ?? "").includes(scope));
  const userId = row?.token_type?.startsWith("user:") ? row.token_type.slice(5) : null;
  if (!userId) return null;
  try {
    return (await getGmailAccessTokenForUser(admin, userId)).accessToken;
  } catch {
    return null;
  }
}

/**
 * A Google token that may read Business Profiles (business.manage scope).
 *
 * The env refresh token lacks that scope, so every review fetch answered
 * "insufficient authentication scopes" and each client kept only the 5
 * reviews Places returns (found 2026-09-28: 212 of 216 clients, e.g. Bayside
 * 5 of 221). The same gap broke Ads until it learned to prefer the stored
 * connection; this does the same, falling back to the env token.
 */
async function getGoogleOAuthAccessTokenForGbp() {
  const admin = createAdminClient();
  const stored = await getGoogleAccessTokenForScope(admin, "business.manage").catch(() => null);
  if (stored) return stored;
  // Until Google is reconnected with business.manage, the Gmail connection of
  // the same Google login already holds that permission (granted when Gmail
  // was connected). Use it rather than keep failing.
  const viaGmail = await gmailTokenWithScope(admin, "business.manage");
  if (viaGmail) return viaGmail;
  const oauthConfig = getGoogleOAuthRefreshConfig();
  if (!oauthConfig) {
    throw new Error("No Google connection with Business Profile access (business.manage).");
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
    throw new Error("Failed to acquire Google OAuth access token for GBP API probe.");
  }
  return token;
}

function parsePlaceId(raw: string) {
  return raw.trim();
}

function parsePublishTimeUnix(value: string | undefined) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? Math.floor(ts / 1000) : null;
}

function starRatingToNumber(value: string | undefined) {
  switch ((value ?? "").toUpperCase()) {
    case "ONE":
      return 1;
    case "TWO":
      return 2;
    case "THREE":
      return 3;
    case "FOUR":
      return 4;
    case "FIVE":
      return 5;
    default:
      return null;
  }
}

function parseRelativeTimeUnix(value: string | null | undefined, nowMs = Date.now()) {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return null;

  if (text === "just now") return Math.floor(nowMs / 1000);
  if (text === "yesterday") return Math.floor((nowMs - 24 * 60 * 60 * 1000) / 1000);

  const minuteMatch = text.match(/^(a|an|\d+)\s+minute(s)?\s+ago$/);
  if (minuteMatch) {
    const count = minuteMatch[1] === "a" || minuteMatch[1] === "an" ? 1 : Number(minuteMatch[1]);
    return Math.floor((nowMs - count * 60 * 1000) / 1000);
  }

  const hourMatch = text.match(/^(a|an|\d+)\s+hour(s)?\s+ago$/);
  if (hourMatch) {
    const count = hourMatch[1] === "a" || hourMatch[1] === "an" ? 1 : Number(hourMatch[1]);
    return Math.floor((nowMs - count * 60 * 60 * 1000) / 1000);
  }

  const dayMatch = text.match(/^(a|an|\d+)\s+day(s)?\s+ago$/);
  if (dayMatch) {
    const count = dayMatch[1] === "a" || dayMatch[1] === "an" ? 1 : Number(dayMatch[1]);
    return Math.floor((nowMs - count * 24 * 60 * 60 * 1000) / 1000);
  }

  const weekMatch = text.match(/^(a|an|\d+)\s+week(s)?\s+ago$/);
  if (weekMatch) {
    const count = weekMatch[1] === "a" || weekMatch[1] === "an" ? 1 : Number(weekMatch[1]);
    return Math.floor((nowMs - count * 7 * 24 * 60 * 60 * 1000) / 1000);
  }

  const monthMatch = text.match(/^(a|an|\d+)\s+month(s)?\s+ago$/);
  if (monthMatch) {
    const count = monthMatch[1] === "a" || monthMatch[1] === "an" ? 1 : Number(monthMatch[1]);
    return Math.floor((nowMs - count * 30 * 24 * 60 * 60 * 1000) / 1000);
  }

  const yearMatch = text.match(/^(a|an|\d+)\s+year(s)?\s+ago$/);
  if (yearMatch) {
    const count = yearMatch[1] === "a" || yearMatch[1] === "an" ? 1 : Number(yearMatch[1]);
    return Math.floor((nowMs - count * 365 * 24 * 60 * 60 * 1000) / 1000);
  }

  return null;
}

async function listGbpLocationNamesByPlaceId(placeId: string, oauthToken: string) {
  // Every page of accounts: the first page holds 20, and a location under a
  // later account would otherwise never match.
  const accounts: NonNullable<GbpAccountManagementResponse["accounts"]> = [];
  let accountsPageToken: string | null = null;
  do {
    const accountsUrl = new URL("https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
    accountsUrl.searchParams.set("pageSize", "20");
    if (accountsPageToken) accountsUrl.searchParams.set("pageToken", accountsPageToken);
    const accountPayload = await fetchJsonWithRetry<GbpAccountManagementResponse & { nextPageToken?: string }>(
      accountsUrl,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${oauthToken}` },
        cache: "no-store",
      },
      { label: "GBP accounts API", retries: 2, baseDelayMs: 700 },
    );
    accounts.push(...(accountPayload.accounts ?? []));
    accountsPageToken = accountPayload.nextPageToken?.trim() || null;
  } while (accountsPageToken);
  const matchingLocationNames: string[] = [];

  for (const account of accounts) {
    const accountName = account.name?.trim();
    if (!accountName) continue;

    let nextPageToken: string | null = null;
    do {
      const url = new URL(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
      );
      url.searchParams.set("readMask", "name,title,metadata");
      url.searchParams.set("pageSize", "100");
      if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);

      const locationsPayload =
        await fetchJsonWithRetry<GbpBusinessInfoLocationsResponse>(
          url,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${oauthToken}` },
            cache: "no-store",
          },
          { label: "GBP locations API", retries: 2, baseDelayMs: 700 },
        );
      const locations = locationsPayload.locations ?? [];
      for (const location of locations) {
        if (
          location.metadata?.placeId?.trim() === placeId &&
          location.name?.trim()
        ) {
          matchingLocationNames.push(location.name.trim());
        }
      }
      nextPageToken = locationsPayload.nextPageToken?.trim() || null;
    } while (nextPageToken);
  }

  return matchingLocationNames;
}

async function fetchGbpApiReviewsForLocation(
  locationName: string,
  oauthToken: string,
): Promise<NormalizedReview[]> {
  // Every page: the API returns at most 50 a page, and a practice with 800
  // reviews would otherwise keep only its newest 50.
  const all: NonNullable<GbpReviewsResponse["reviews"]> = [];
  let pageToken: string | null = null;
  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${locationName}/reviews`);
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const payload = await fetchJsonWithRetry<GbpReviewsResponse & { nextPageToken?: string }>(
      url,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${oauthToken}` },
        cache: "no-store",
      },
      { label: "GBP reviews API", retries: 2, baseDelayMs: 700 },
    );
    all.push(...(payload.reviews ?? []));
    pageToken = payload.nextPageToken?.trim() || null;
  } while (pageToken);
  return all.map((review) => {
    const relative = null;
    return {
      authorName: review.reviewer?.displayName ?? null,
      rating: starRatingToNumber(review.starRating),
      text: review.comment ?? null,
      relativeTimeDescription: relative,
      reviewTimeUnix:
        parsePublishTimeUnix(review.updateTime) ??
        parsePublishTimeUnix(review.createTime) ??
        null,
    };
  });
}

function normalizeLegacyReview(
  review: NonNullable<NonNullable<LegacyPlaceDetailsResponse["result"]>["reviews"]>[number],
): NormalizedReview {
  const relative = review.relative_time_description ?? null;
  return {
    authorName: review.author_name ?? null,
    rating: typeof review.rating === "number" ? review.rating : null,
    text: review.text ?? null,
    relativeTimeDescription: relative,
    reviewTimeUnix:
      typeof review.time === "number" ? review.time : parseRelativeTimeUnix(relative),
  };
}

function mergeAndSortReviews(primary: NormalizedReview[], secondary: NormalizedReview[]) {
  const seen = new Set<string>();
  const merged: NormalizedReview[] = [];

  for (const review of [...primary, ...secondary]) {
    const dedupeKey = [
      review.authorName ?? "",
      review.rating ?? "",
      review.text ?? "",
      review.reviewTimeUnix ?? "",
    ].join("|");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(review);
  }

  merged.sort((a, b) => {
    if (a.reviewTimeUnix == null && b.reviewTimeUnix == null) return 0;
    if (a.reviewTimeUnix == null) return 1;
    if (b.reviewTimeUnix == null) return -1;
    return b.reviewTimeUnix - a.reviewTimeUnix;
  });

  return merged;
}

async function fetchLastPostAt(locationName: string, oauthToken: string): Promise<string | null> {
  try {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${locationName}/localPosts`);
    url.searchParams.set("pageSize", "1");
    const payload = await fetchJsonWithRetry<GbpLocalPostsResponse>(
      url,
      { method: "GET", headers: { Authorization: `Bearer ${oauthToken}` }, cache: "no-store" },
      { label: "GBP localPosts API", retries: 2, baseDelayMs: 600 },
    );
    const post = payload.localPosts?.[0];
    return post?.updateTime ?? post?.createTime ?? null;
  } catch {
    return null;
  }
}

async function fetchProfileFields(locationName: string, oauthToken: string): Promise<GbpProfileFields | null> {
  try {
    const url = new URL(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}`,
    );
    url.searchParams.set("readMask", "phoneNumbers,categories,regularHours,profile,websiteUri");
    const data = await fetchJsonWithRetry<GbpBusinessInfoResponse>(
      url,
      { method: "GET", headers: { Authorization: `Bearer ${oauthToken}` }, cache: "no-store" },
      { label: "GBP business info API", retries: 2, baseDelayMs: 600 },
    );
    return {
      phone: !!data.phoneNumbers?.primaryPhone,
      categories: !!data.categories?.primaryCategory,
      hours: Array.isArray(data.regularHours?.periods) && data.regularHours!.periods!.length > 0,
      description: !!data.profile?.description,
      website: !!data.websiteUri,
    };
  } catch {
    return null;
  }
}

export async function runGbpSync(rawPlaceId: string): Promise<GbpSyncResult> {
  const placeId = parsePlaceId(rawPlaceId);
  if (!placeId) {
    throw new Error("Google Business Profile place ID is required.");
  }
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GOOGLE_MAPS_API_KEY for GBP sync.");
  }
  const endpoint = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=id,displayName,googleMapsUri,websiteUri,formattedAddress,rating,userRatingCount,reviews&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GBP API failed (${response.status}): ${text.slice(0, 400)}`);
  }
  const payload = (await response.json()) as PlacesApiResponse;
  const placesReviews =
    payload.reviews?.map((review) => ({
      relativeTimeDescription: review.relativePublishTimeDescription ?? null,
      authorName: review.authorAttribution?.displayName ?? null,
      rating: typeof review.rating === "number" ? review.rating : null,
      text: review.text?.text ?? null,
      reviewTimeUnix:
        parsePublishTimeUnix(review.publishTime) ??
        parseRelativeTimeUnix(review.relativePublishTimeDescription),
    })) ?? [];

  const legacyEndpoint = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId,
  )}&fields=reviews&reviews_sort=newest&key=${encodeURIComponent(apiKey)}`;
  let legacyReviewsNormalized: NormalizedReview[] = [];
  try {
    const legacyResponse = await fetch(legacyEndpoint, {
      method: "GET",
      cache: "no-store",
    });
    const legacyPayload = (await legacyResponse.json()) as LegacyPlaceDetailsResponse;
    const legacyReviews = legacyPayload.result?.reviews ?? [];
    legacyReviewsNormalized = legacyReviews.map((row) => normalizeLegacyReview(row));
  } catch (error) {
  }

  const reviews = mergeAndSortReviews(legacyReviewsNormalized, placesReviews);
  let gbpApiReviews: NormalizedReview[] = [];
  let matchedGbpLocationCount = 0;
  let gbpApiError: string | null = null;
  let lastPostAt: string | null = null;
  let profileFields: GbpProfileFields | null = null;

  try {
    const oauthToken = await getGoogleOAuthAccessTokenForGbp();
    const locationNames = await listGbpLocationNamesByPlaceId(placeId, oauthToken);
    matchedGbpLocationCount = locationNames.length;
    for (const locationName of locationNames) {
      const fetched = await fetchGbpApiReviewsForLocation(locationName, oauthToken);
      gbpApiReviews = mergeAndSortReviews(gbpApiReviews, fetched);

      if (!lastPostAt) {
        lastPostAt = await fetchLastPostAt(locationName, oauthToken);
      }
      if (!profileFields) {
        profileFields = await fetchProfileFields(locationName, oauthToken);
      }
    }
  } catch (error) {
    gbpApiError = error instanceof Error ? error.message : "unknown";
  }

  const mergedReviews = mergeAndSortReviews(gbpApiReviews, reviews);

  return {
    placeId,
    placeName: payload.displayName?.text ?? null,
    profileUrl: payload.googleMapsUri ?? null,
    websiteUrl: payload.websiteUri ?? null,
    address: payload.formattedAddress ?? null,
    rating: typeof payload.rating === "number" ? payload.rating : null,
    userRatingsTotal:
      typeof payload.userRatingCount === "number" ? payload.userRatingCount : null,
    lastPostAt,
    profileFields,
    reviews: mergedReviews,
    diagnostics: {
      placesReviewCount: placesReviews.length,
      legacyReviewCount: legacyReviewsNormalized.length,
      gbpApiReviewCount: gbpApiReviews.length,
      matchedGbpLocationCount,
      gbpApiError,
    },
  };
}
