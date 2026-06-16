import {
  businessMatchesTitle,
  domainFromUrlOrHost,
} from "@/lib/dataforseo/domain-discovery";
import type { LocalPackListing } from "@/lib/local-rank/types";

export function listingMatchesPractice(input: {
  businessName: string;
  websiteUrl?: string | null;
  listing: LocalPackListing;
}): boolean {
  if (businessMatchesTitle(input.businessName, input.listing.title)) {
    return true;
  }

  const websiteDomain = domainFromUrlOrHost(input.websiteUrl);
  const listingDomain = domainFromUrlOrHost(input.listing.domain);
  if (websiteDomain && listingDomain && websiteDomain === listingDomain) {
    return true;
  }

  return false;
}

export function findPracticeRankInLocalPack(input: {
  businessName: string;
  websiteUrl?: string | null;
  listings: LocalPackListing[];
}): {
  rank: number | null;
  inLocalPack: boolean;
  matchedListing: LocalPackListing | null;
  topCompetitor: LocalPackListing | null;
} {
  const topCompetitor = input.listings[0] ?? null;
  const matched = input.listings.find((listing) =>
    listingMatchesPractice({
      businessName: input.businessName,
      websiteUrl: input.websiteUrl,
      listing,
    }),
  );

  return {
    rank: matched?.rank ?? null,
    inLocalPack: Boolean(matched),
    matchedListing: matched ?? null,
    topCompetitor,
  };
}
