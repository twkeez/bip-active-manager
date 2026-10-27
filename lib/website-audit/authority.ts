import { fetchBacklinkSummary } from "@/lib/dataforseo/backlinks";
import { fetchPlaceSnapshot, getReviewTask, postReviewTask } from "@/lib/dataforseo/reputation";
import { getDataForSeoConfig } from "@/lib/env";
import type { AuthorityResults, DomainAuthority } from "@/lib/website-audit/types";

// Section 2: outside authority and reputation. DataForSEO's backlink summary
// for the practice and any competitors (its own 0-1000 "rank", which the
// report labels as DataForSEO's, not "Domain Rating"), then the Google
// listing: rating, review count and the 20 newest reviews.

const FEATURE = "Website audit: authority";
const REVIEW_COUNT = 20;
/** The review pull is queued at DataForSEO; it usually lands in about a minute. */
const REVIEW_WAIT_MS = 150_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The practice's Google listing id from its name and town (Places Text Search
 * asking for ids only, which Google doesn't charge for). The listing found is
 * shown in the report so a person can confirm it's the right practice.
 */
async function findPlaceId(practiceName: string, city: string | null, state: string | null): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.id" },
    body: JSON.stringify({ textQuery: [practiceName, city, state].filter(Boolean).join(", "), pageSize: 1 }),
  });
  if (!response.ok) throw new Error(`Google Places lookup failed (${response.status}).`);
  const data = (await response.json()) as { places?: { id?: string }[] };
  return data.places?.[0]?.id ?? null;
}

async function domainAuthority(config: { login: string; password: string }, domain: string): Promise<{ result: DomainAuthority; cost: number }> {
  const summary = await fetchBacklinkSummary(config, domain, FEATURE);
  if (!summary.ok) return { result: { domain, error: summary.error, rank: null, referringDomains: null, backlinks: null, spamScore: null }, cost: summary.cost ?? 0 };
  return {
    result: {
      domain,
      error: null,
      rank: summary.summary.rank,
      referringDomains: summary.summary.referringDomains,
      backlinks: summary.summary.backlinks,
      spamScore: summary.summary.spamScore,
    },
    cost: summary.cost,
  };
}

export async function checkAuthority(audit: {
  domain: string;
  practiceName: string;
  city: string | null;
  state: string | null;
  competitors: string[];
  knownPlaceId: string | null;
}): Promise<AuthorityResults> {
  const config = getDataForSeoConfig();
  if (!config) throw new Error("DataForSEO isn't configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).");
  let cost = 0;
  const notes: string[] = [];

  const domains = await Promise.all([audit.domain, ...audit.competitors].map((d) => domainAuthority(config, d)));
  for (const d of domains) cost += d.cost;
  const [own, ...competitors] = domains.map((d) => d.result);

  let placeId = audit.knownPlaceId;
  let placeSource: AuthorityResults["google"]["placeSource"] = placeId ? "client record" : "search";
  if (!placeId) {
    placeId = await findPlaceId(audit.practiceName, audit.city, audit.state).catch((error: unknown) => {
      notes.push(error instanceof Error ? error.message : "Google Places lookup failed.");
      return null;
    });
    if (!placeId) placeSource = null;
  }

  const google: AuthorityResults["google"] = {
    placeId,
    placeSource,
    listingName: null,
    listingAddress: null,
    rating: null,
    reviewCount: null,
    reviews: [],
    reviewsError: null,
  };

  if (!placeId) {
    google.reviewsError = "No Google listing found for this practice name and town.";
  } else {
    const snapshot = await fetchPlaceSnapshot(config, placeId, FEATURE);
    if (snapshot.ok) {
      cost += snapshot.cost;
      google.listingName = snapshot.snapshot.title;
      google.listingAddress = snapshot.snapshot.address;
      google.rating = snapshot.snapshot.rating;
      google.reviewCount = snapshot.snapshot.votesCount;
    } else {
      notes.push(`Google listing: ${snapshot.error}`);
    }

    const task = await postReviewTask(config, placeId, REVIEW_COUNT, FEATURE);
    if (!task.ok) {
      google.reviewsError = task.error;
    } else {
      cost += task.cost;
      const started = Date.now();
      for (;;) {
        await sleep(10_000);
        const got = await getReviewTask(config, task.taskId);
        if (!got.ok) {
          google.reviewsError = got.error;
          break;
        }
        if (!got.pending) {
          google.reviews = got.reviews
            .slice(0, REVIEW_COUNT)
            // Reviewer names stay out: the report quotes what was said, not who said it.
            .map((r) => ({ rating: r.rating, text: r.reviewText, date: r.reviewedAt, ownerAnswered: Boolean(r.ownerAnswer) }));
          if (google.reviewCount == null) google.reviewCount = got.totalCount;
          break;
        }
        if (Date.now() - started > REVIEW_WAIT_MS) {
          google.reviewsError = "Google reviews took too long to arrive; run this step again.";
          break;
        }
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    own,
    competitors,
    google,
    notes,
    costUsd: Number(cost.toFixed(4)),
  };
}
