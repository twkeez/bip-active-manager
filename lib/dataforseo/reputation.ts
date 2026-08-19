import {
  DATAFORSEO_ENDPOINTS,
  dataForSeoBasicAuthHeader,
  dataForSeoTaskError,
  extractTaskResult,
  placeIdKeyword,
  postDataForSeoLive,
} from "@/lib/dataforseo/client";

export type PlaceSnapshot = {
  placeId: string;
  title: string | null;
  rating: number | null;
  votesCount: number | null;
  ratingDistribution: Record<string, number>;
  // Google's own auto-extracted review topics with mention counts.
  placeTopics: Record<string, number>;
  address: string | null;
  city: string | null;
  region: string | null;
};

export type ReviewRecord = {
  reviewId: string;
  rating: number | null;
  reviewText: string | null;
  profileName: string | null;
  reviewedAt: string | null;
  ownerAnswer: string | null;
  localGuide: boolean;
};

type Config = { login: string; password: string };

// DataForSEO stamps look like "2026-08-18 14:02:11 +00:00".
function toIso(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = new Date(raw.trim().replace(" ", "T").replace(/\s?\+00:00$/, "Z"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toIntMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

// Profile stats — live endpoint, instant, ~0.5c a call.
export async function fetchPlaceSnapshot(
  config: Config,
  placeId: string,
): Promise<{ ok: true; snapshot: PlaceSnapshot } | { ok: false; error: string }> {
  if (!placeId.trim()) return { ok: false, error: "This client has no Google Place ID." };

  const res = await postDataForSeoLive(
    DATAFORSEO_ENDPOINTS.myBusinessInfo,
    config.login,
    config.password,
    [{ keyword: placeIdKeyword(placeId), location_code: 2840, language_code: "en" }],
  );
  if (!res.ok) return { ok: false, error: res.error ?? "Business lookup failed." };

  const result = extractTaskResult(res.data) as { items?: unknown[] } | null;
  const item = (result?.items?.[0] ?? null) as
    | {
        title?: string;
        rating?: { value?: number; votes_count?: number };
        rating_distribution?: unknown;
        place_topics?: unknown;
        address?: string;
        address_info?: { city?: string | null; region?: string | null };
      }
    | null;
  if (!item) return { ok: false, error: "Google returned no business profile for this place ID." };

  return {
    ok: true,
    snapshot: {
      placeId,
      title: item.title ?? null,
      rating: typeof item.rating?.value === "number" ? item.rating.value : null,
      votesCount:
        typeof item.rating?.votes_count === "number" ? item.rating.votes_count : null,
      ratingDistribution: toIntMap(item.rating_distribution),
      placeTopics: toIntMap(item.place_topics),
      address: item.address ?? null,
      city: item.address_info?.city ?? null,
      region: item.address_info?.region ?? null,
    },
  };
}

// Queue a review pull. Priority 2 costs a little more but returned in ~60s in
// testing, where the standard queue was still pending after 15 minutes.
//
// Not routed through postDataForSeoLive: that helper treats any task status
// other than 20000 as a failure, and a freshly queued task reports 20100
// ("Task Created"), which is success here.
export async function postReviewTask(
  config: Config,
  placeId: string,
  depth = 200,
): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  if (!placeId.trim()) return { ok: false, error: "This client has no Google Place ID." };

  const response = await fetch(DATAFORSEO_ENDPOINTS.reviewsTaskPost, {
    method: "POST",
    headers: {
      Authorization: dataForSeoBasicAuthHeader(config.login, config.password),
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        keyword: placeIdKeyword(placeId),
        location_code: 2840,
        language_code: "en",
        depth: Math.min(Math.max(depth, 10), 700),
        sort_by: "newest",
        priority: 2,
      },
    ]),
  });

  const data = (await response.json()) as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{ id?: string; status_code?: number; status_message?: string }>;
  };

  if (!response.ok || (data.status_code != null && data.status_code !== 20000)) {
    return { ok: false, error: data.status_message ?? "Could not queue the review pull." };
  }

  const task = data.tasks?.[0];
  // 20100 = Task Created. 20000 would also be fine; anything else is a failure.
  if (task?.status_code != null && task.status_code !== 20100 && task.status_code !== 20000) {
    return { ok: false, error: task.status_message ?? "Review task was rejected." };
  }
  if (!task?.id) return { ok: false, error: "DataForSEO did not return a task id." };
  return { ok: true, taskId: task.id };
}

type ReviewPayload = {
  review_id?: string;
  rating?: { value?: number };
  review_text?: string | null;
  profile_name?: string | null;
  timestamp?: string;
  owner_answer?: string | null;
  local_guide?: boolean;
};

// Poll a queued task. `pending` is the normal state for the first minute or so
// and is not an error — callers keep polling.
export async function getReviewTask(
  config: Config,
  taskId: string,
): Promise<
  | { ok: true; pending: true }
  | { ok: true; pending: false; reviews: ReviewRecord[]; totalCount: number | null }
  | { ok: false; error: string }
> {
  const response = await fetch(`${DATAFORSEO_ENDPOINTS.reviewsTaskGet}/${taskId}`, {
    headers: { Authorization: dataForSeoBasicAuthHeader(config.login, config.password) },
  });
  const data = await response.json();

  const task = (data as { tasks?: Array<{ status_code?: number }> })?.tasks?.[0];
  // 40602 = still queued. Everything else non-20000 is a real failure.
  if (task?.status_code === 40602) return { ok: true, pending: true };

  const taskError = dataForSeoTaskError(data);
  if (taskError) return { ok: false, error: taskError };

  const result = extractTaskResult(data) as
    | { items?: ReviewPayload[]; reviews_count?: number }
    | null;
  if (!result?.items) return { ok: true, pending: true };

  // Deduplicate on review_id before returning. A single upsert command cannot
  // touch the same conflict target twice — Postgres raises 21000 and the whole
  // batch fails — so a repeated id from DataForSEO would lose every review in
  // the pull, not just the duplicate.
  const seen = new Map<string, ReviewRecord>();
  for (const item of result.items) {
    if (!item?.review_id || seen.has(item.review_id)) continue;
    seen.set(item.review_id, {
      reviewId: item.review_id,
      rating: typeof item.rating?.value === "number" ? item.rating.value : null,
      reviewText: item.review_text?.trim() ? item.review_text : null,
      profileName: item.profile_name ?? null,
      reviewedAt: toIso(item.timestamp),
      ownerAnswer: item.owner_answer?.trim() ? item.owner_answer : null,
      localGuide: item.local_guide === true,
    });
  }
  const reviews = [...seen.values()];

  return {
    ok: true,
    pending: false,
    reviews,
    totalCount: typeof result.reviews_count === "number" ? result.reviews_count : null,
  };
}
