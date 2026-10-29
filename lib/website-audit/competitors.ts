import { DATAFORSEO_ENDPOINTS, extractTaskResult, postDataForSeoLive } from "@/lib/dataforseo/client";
import { fetchPlaceSnapshot } from "@/lib/dataforseo/reputation";
import { getDataForSeoConfig } from "@/lib/env";
import type { AuditResults, CompetitorListing, CompetitorResults, ServiceComparison, SideService } from "@/lib/website-audit/types";

// Reviews against the competition: the Google Maps results a pet owner sees
// near the practice. Always other vets; and, for each extra service the
// practice offers (grooming, boarding, daycare, training), the businesses that
// do only that. Their rating is about that one service, while the practice's
// one rating covers everything it does, so the report keeps them apart.
// Each search is about 0.2¢ at DataForSEO.

const FEATURE = "Website audit: competitors";
const SHOWN = 8;
const ZOOM = "13z";

const VET_CATEGORY = /veterinar|animal hospital|animal clinic|emergency vet/i;

export const SIDE_SERVICES: Record<
  SideService,
  /** googleCategory: the extra Google Business Profile category to suggest when the listing lacks one. */
  { label: string; search: string; offers: RegExp; category: RegExp; googleCategory: string }
> = {
  grooming: { label: "Grooming", search: "dog groomer", offers: /\bgroom/i, category: /groom/i, googleCategory: "Pet groomer" },
  boarding: {
    label: "Boarding",
    search: "pet boarding",
    // Not plain "board": "board-certified" is on every specialist's page.
    offers: /\bboarding\b|\bkennels?\b|pet (resort|hotel)|\blodging\b/i,
    category: /kennel|boarding|pet (hotel|resort)|dog hotel/i,
    googleCategory: "Pet boarding service",
  },
  daycare: { label: "Doggy daycare", search: "dog daycare", offers: /day[\s-]?care/i, category: /day[\s-]?care/i, googleCategory: "Dog day care center" },
  training: {
    label: "Training",
    search: "dog trainer",
    offers: /(dog|puppy|pet|obedience|behaviou?r) (training|classes)|\btrainers?\b/i,
    category: /trainer|training/i,
    googleCategory: "Dog trainer",
  },
};

const bareDomain = (d: string | null | undefined) => (d ?? "").toLowerCase().replace(/^www\./, "");

function milesBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * The side services the practice offers, each with where we saw it: its
 * Google categories, its menu, its non-blog page addresses, and the services
 * named on its non-blog pages. Blog posts don't count: "grooming tips" isn't
 * a grooming service.
 */
export function detectSideServices(results: AuditResults, googleCategories: string[]): Partial<Record<SideService, string[]>> {
  const t = results.technical;
  const sources: { text: string; where: string }[] = [
    ...googleCategories.map((c) => ({ text: c, where: `"${c}" on your Google listing` })),
    ...(t?.pages ?? []).flatMap((p) => p.navLinks.map((l) => ({ text: l.text, where: `"${l.text}" in your website menu` }))),
    ...(t?.pages ?? [])
      .filter((p) => !/\/blog\/|\/\d{4}\/\d{2}\//.test(p.url))
      .map((p) => ({ text: new URL(p.url).pathname.replace(/[-_/]/g, " "), where: p.url })),
    ...(results.content?.pages ?? [])
      .filter((p) => p.pageType !== "blog_post")
      .flatMap((p) => p.servicesNamed.map((s) => ({ text: s, where: `"${s}" on ${p.url}` }))),
  ];
  const found: Partial<Record<SideService, string[]>> = {};
  for (const [service, def] of Object.entries(SIDE_SERVICES) as [SideService, (typeof SIDE_SERVICES)[SideService]][]) {
    const where = [...new Set(sources.filter((s) => def.offers.test(s.text)).map((s) => s.where))];
    if (where.length) found[service] = where.slice(0, 3);
  }
  return found;
}

type MapsItem = {
  type?: string;
  rank_group?: number;
  title?: string;
  domain?: string | null;
  category?: string | null;
  place_id?: string | null;
  rating?: { value?: number | null; votes_count?: number | null } | null;
  latitude?: number | null;
  longitude?: number | null;
};

/** Google's organic Maps results (ads dropped), as listings measured from the practice. */
export function toListings(items: MapsItem[], you: { placeId: string; domain: string; latitude: number; longitude: number }): CompetitorListing[] {
  return items
    .filter((i) => i.type === "maps_search" && i.title)
    .map((i) => ({
      name: i.title as string,
      domain: i.domain ?? null,
      category: i.category ?? null,
      rating: typeof i.rating?.value === "number" ? i.rating.value : null,
      reviewCount: typeof i.rating?.votes_count === "number" ? i.rating.votes_count : null,
      miles:
        typeof i.latitude === "number" && typeof i.longitude === "number"
          ? Math.round(milesBetween(you, { latitude: i.latitude, longitude: i.longitude }) * 10) / 10
          : null,
      position: i.rank_group ?? 0,
      isYou: i.place_id === you.placeId || (Boolean(i.domain) && bareDomain(i.domain) === bareDomain(you.domain)),
    }));
}

/** Splits one search's results into the comparison the report shows. */
export function compareListings(service: ServiceComparison["service"], all: CompetitorListing[]): Pick<ServiceComparison, "yourPosition" | "listings" | "vetsInResults"> {
  const yourPosition = all.find((l) => l.isYou)?.position ?? null;
  const isVet = (l: CompetitorListing) => VET_CATEGORY.test(l.category ?? "");
  if (service === "vet") return { yourPosition, listings: all.filter((l) => !l.isYou && isVet(l)).slice(0, SHOWN), vetsInResults: 0 };
  const def = SIDE_SERVICES[service];
  return {
    yourPosition,
    // The practice's own separate listing for the service (say, its grooming salon) stays in, marked as yours.
    listings: all.filter((l) => l.isYou ? !isVet(l) : !isVet(l) && def.category.test(l.category ?? "")).slice(0, SHOWN),
    vetsInResults: all.filter((l) => !l.isYou && isVet(l)).length,
  };
}

/** How the practice's rating and review count sit among the listings (its own listings excluded). */
export function standing(you: { rating: number | null; reviewCount: number | null }, listings: CompetitorListing[]) {
  const others = listings.filter((l) => !l.isYou);
  const rated = others.filter((l) => l.rating != null);
  const counted = others.filter((l) => l.reviewCount != null);
  const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  return {
    count: others.length,
    higherRatingThan: you.rating == null ? null : rated.filter((l) => (l.rating as number) < you.rating!).length,
    lowerRatingThan: you.rating == null ? null : rated.filter((l) => (l.rating as number) > you.rating!).length,
    moreReviewsThan: you.reviewCount == null ? null : counted.filter((l) => (l.reviewCount as number) < you.reviewCount!).length,
    medianRating: median(rated.map((l) => l.rating as number)),
    medianReviews: median(counted.map((l) => l.reviewCount as number)),
  };
}

async function searchMaps(config: { login: string; password: string }, keyword: string, at: { latitude: number; longitude: number }) {
  const response = await postDataForSeoLive(
    DATAFORSEO_ENDPOINTS.mapsAdvanced,
    config.login,
    config.password,
    [{ keyword, location_coordinate: `${at.latitude},${at.longitude},${ZOOM}`, language_code: "en", depth: 20 }],
    FEATURE,
  );
  const items = ((extractTaskResult(response.data) as { items?: MapsItem[] } | null)?.items ?? []) as MapsItem[];
  return { ok: response.ok, error: response.error, cost: response.cost, items };
}

export async function checkCompetitors(audit: { domain: string }, results: AuditResults): Promise<CompetitorResults> {
  const placeId = results.authority?.google.placeId;
  if (!placeId) throw new Error("Run “Authority & reviews” first: this step searches from the practice's Google listing.");
  const config = getDataForSeoConfig();
  if (!config) throw new Error("DataForSEO isn't configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).");

  const snapshot = await fetchPlaceSnapshot(config, placeId, FEATURE);
  if (!snapshot.ok) throw new Error(`Couldn't read the practice's Google listing: ${snapshot.error}`);
  const { latitude, longitude } = snapshot.snapshot;
  if (latitude == null || longitude == null) throw new Error("Google didn't give a map location for the practice's listing.");
  let cost = snapshot.cost;
  const notes: string[] = [];
  const categories = [snapshot.snapshot.category, ...snapshot.snapshot.additionalCategories].filter((c): c is string => Boolean(c));
  const you = { placeId, domain: audit.domain, latitude, longitude };

  const offered = detectSideServices(results, categories);
  const searches: { service: ServiceComparison["service"]; label: string; search: string; offeredBecause: string[] }[] = [
    { service: "vet", label: "Vets", search: "veterinarian", offeredBecause: [] },
    ...(Object.entries(offered) as [SideService, string[]][]).map(([service, where]) => ({ service, label: SIDE_SERVICES[service].label, search: SIDE_SERVICES[service].search, offeredBecause: where })),
  ];

  const comparisons = await Promise.all(
    searches.map(async (s): Promise<ServiceComparison> => {
      const got = await searchMaps(config, s.search, you);
      cost += got.cost;
      const base = { service: s.service, label: s.label, search: s.search, offeredBecause: s.offeredBecause };
      if (!got.ok) {
        notes.push(`Google Maps search "${s.search}": ${got.error}`);
        return { ...base, yourPosition: null, listings: [], vetsInResults: 0, error: got.error ?? "Search failed." };
      }
      return { ...base, ...compareListings(s.service, toListings(got.items, you)), error: null };
    }),
  );

  // The same rating and count as the rest of the report, read from the review step.
  const g = results.authority?.google;
  return {
    ranAt: new Date().toISOString(),
    you: {
      name: g?.listingName ?? snapshot.snapshot.title,
      rating: g?.rating ?? snapshot.snapshot.rating,
      reviewCount: g?.reviewCount ?? snapshot.snapshot.votesCount,
      categories,
      latitude,
      longitude,
    },
    comparisons,
    notes,
    costUsd: Number(cost.toFixed(4)),
  };
}
