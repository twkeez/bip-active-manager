import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The market and competitor research captured during onboarding.
 *
 * Read-only background for whoever picks up the account — nothing here is
 * refreshed or re-run from the client view. It is a snapshot of what was true
 * at onboarding, which is why every part carries the date it was captured:
 * competitor promos and search landscapes move, and stale research presented as
 * current is worse than no research at all.
 *
 * Only a handful of clients have been through the onboarding hub so far, so the
 * common case is null. Callers should render nothing rather than an empty shell.
 */
export type ClientBackground = {
  competitors: Array<{ name: string; note: string }>;
  marketSnapshot: string | null;
  searchLandscape: string | null;
  /** When the discovery work was captured. */
  discoveryAt: string | null;
  competitorAds: Array<{
    name: string;
    offers: string;
    positioning: string;
    counter: string;
  }>;
  competitorAdsAt: string | null;
};

type DiscoveryJson = {
  competitors?: Array<{ name?: string; note?: string }>;
  marketSnapshot?: string;
  searchLandscape?: string;
};

type CompetitorAdJson = {
  name?: string;
  offers?: string;
  positioning?: string;
  counter?: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Returns null when the client has no onboarding research worth showing. */
export async function loadClientBackground(
  supabase: SupabaseClient,
  clientId: number,
): Promise<ClientBackground | null> {
  const { data } = await supabase
    .from("client_onboarding_intake")
    .select("discovery, discovery_at, competitor_ads, competitor_ads_at")
    .eq("client_id", clientId)
    .maybeSingle<{
      discovery: DiscoveryJson | null;
      discovery_at: string | null;
      competitor_ads: CompetitorAdJson[] | null;
      competitor_ads_at: string | null;
    }>();

  if (!data) return null;

  const discovery = data.discovery ?? {};

  const competitors = (discovery.competitors ?? [])
    .map((row) => ({ name: text(row?.name), note: text(row?.note) }))
    .filter((row) => row.name || row.note);

  const competitorAds = (data.competitor_ads ?? [])
    .map((row) => ({
      name: text(row?.name),
      offers: text(row?.offers),
      positioning: text(row?.positioning),
      counter: text(row?.counter),
    }))
    .filter((row) => row.name || row.offers || row.positioning || row.counter);

  const marketSnapshot = text(discovery.marketSnapshot) || null;
  const searchLandscape = text(discovery.searchLandscape) || null;

  // An intake row exists for clients who only got partway through onboarding,
  // so presence of the row is not presence of research.
  const hasAnything =
    competitors.length > 0 ||
    competitorAds.length > 0 ||
    marketSnapshot !== null ||
    searchLandscape !== null;
  if (!hasAnything) return null;

  return {
    competitors,
    marketSnapshot,
    searchLandscape,
    discoveryAt: data.discovery_at,
    competitorAds,
    competitorAdsAt: data.competitor_ads_at,
  };
}
