import { describe, expect, it } from "vitest";
import { compareListings, detectSideServices, standing, toListings } from "@/lib/website-audit/competitors";
import type { AuditResults, CompetitorListing } from "@/lib/website-audit/types";

const you = { placeId: "P1", domain: "www.dhah.org", latitude: 33.94, longitude: -84.7 };
const item = (rank: number, title: string, category: string, extra: Record<string, unknown> = {}) => ({
  type: "maps_search",
  rank_group: rank,
  title,
  category,
  domain: `${title.toLowerCase().replace(/\W+/g, "")}.com`,
  rating: { value: 4.5, votes_count: 100 },
  latitude: 33.95,
  longitude: -84.7,
  ...extra,
});

describe("toListings", () => {
  it("drops ads, measures miles and spots the practice by place id or domain", () => {
    const listings = toListings(
      [
        { ...item(1, "Ad Vet", "Veterinarian"), type: "maps_paid_item" },
        item(1, "Dallas Highway", "Veterinarian", { place_id: "P1" }),
        item(2, "DHAH Grooming", "Pet groomer", { domain: "dhah.org" }),
        item(3, "Other Vet", "Veterinarian"),
      ],
      you,
    );
    expect(listings.map((l) => [l.name, l.isYou])).toEqual([
      ["Dallas Highway", true],
      ["DHAH Grooming", true],
      ["Other Vet", false],
    ]);
    expect(listings[2].miles).toBe(0.7);
  });
});

describe("compareListings", () => {
  const all = toListings(
    [
      item(1, "Paws Spa", "Pet groomer"),
      item(2, "Dallas Highway", "Veterinarian", { place_id: "P1" }),
      item(3, "Other Vet", "Animal hospital"),
      item(4, "DHAH Grooming", "Pet groomer", { domain: "dhah.org" }),
      item(5, "PetSupplies", "Pet supply store"),
    ],
    you,
  );

  it("keeps only other vets for the vet search", () => {
    expect(compareListings("vet", all).listings.map((l) => l.name)).toEqual(["Other Vet"]);
  });

  it("keeps dedicated businesses (and the practice's own salon) for a side service", () => {
    const groom = compareListings("grooming", all);
    expect(groom.listings.map((l) => l.name)).toEqual(["Paws Spa", "DHAH Grooming"]);
    expect(groom.yourPosition).toBe(2);
    expect(groom.vetsInResults).toBe(1);
  });
});

describe("standing", () => {
  const l = (rating: number, reviewCount: number, isYou = false): CompetitorListing => ({ name: "x", domain: null, category: null, rating, reviewCount, miles: 1, position: 1, isYou });
  it("counts who the practice beats, ignoring its own listings", () => {
    expect(standing({ rating: 4.8, reviewCount: 400 }, [l(4.9, 1000), l(4.5, 100), l(4.8, 300), l(5, 5, true)])).toEqual({
      count: 3,
      higherRatingThan: 1,
      lowerRatingThan: 1,
      moreReviewsThan: 2,
      medianRating: 4.8,
      medianReviews: 300,
    });
  });
});

describe("detectSideServices", () => {
  const results = {
    technical: {
      pages: [
        { url: "https://x.com/services/grooming/", navLinks: [{ text: "Boarding", href: "/boarding" }] },
        { url: "https://x.com/blog/dog-training-tips/", navLinks: [] },
        { url: "https://x.com/about/board-certified-surgeon/", navLinks: [] },
      ],
    },
    content: { pages: [{ url: "https://x.com/", pageType: "home", servicesNamed: ["Doggy Daycare"] }] },
  } as unknown as AuditResults;

  it("finds services from the menu, page addresses, pages and Google categories, but not blog posts or board-certified", () => {
    const found = detectSideServices(results, ["Veterinarian", "Dog trainer"]);
    expect(Object.keys(found).sort()).toEqual(["boarding", "daycare", "grooming", "training"]);
    expect(found.training).toEqual(['"Dog trainer" on your Google listing']);
    expect(detectSideServices(results, []).training).toBeUndefined();
  });
});
