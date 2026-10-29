import { describe, expect, it } from "vitest";
import { practiceMatchProblems } from "@/lib/website-audit/practice-match";
import type { AuditResults, CrawlPage } from "@/lib/website-audit/types";

const audit = { domain: "edgewatervet.com", city: "Indian Land", state: "SC" };

const home = (title: string, text: string) =>
  ({ url: "https://www.edgewatervet.com/", finalUrl: "https://www.edgewatervet.com/", title, text }) as CrawlPage;

const results = (google: Partial<NonNullable<AuditResults["authority"]>["google"]>, page?: CrawlPage): AuditResults =>
  ({
    authority: { google: { listingName: "Edgewater Animal Hospital", listingAddress: null, ...google } },
    technical: page ? { pages: [page] } : undefined,
  }) as AuditResults;

describe("practiceMatchProblems", () => {
  it("passes when the listing, website and town agree", () => {
    const r = results(
      { listingWebsite: "https://www.edgewatervet.com/", listingAddress: "1170 Edgewater Corporate Pkwy #101, Indian Land, SC 29707" },
      home("Edgewater Animal Hospital | Indian Land Vet", "Proudly serving Indian Land, Fort Mill and Waxhaw. 1170 Edgewater Corporate Pkwy, Indian Land, SC 29707"),
    );
    expect(practiceMatchProblems(audit, r)).toEqual([]);
  });

  it("flags another practice's listing and website (the Edgewater mix-up)", () => {
    const r = results(
      { listingWebsite: "http://edgewatervets.com/", listingAddress: "5925 Edgewater Dr, Orlando, FL 32810" },
      home("Veterinarian in Alpharetta, GA | Edgewater Animal Hospital", "Experience the best veterinary care Alpharetta, GA has to offer."),
    );
    const problems = practiceMatchProblems({ ...audit, domain: "edgewateranimalhospital.com" }, r);
    expect(problems.map((p) => p.what)).toEqual(["listing-website", "listing-place", "website-place"]);
    expect(problems[1].detail).toContain("Florida");
    expect(problems[2].detail).toContain("Georgia");
  });

  it("ignores www and trailing slashes, and accepts a full state name", () => {
    const r = results({ listingWebsite: "edgewatervet.com", listingAddress: "Indian Land, South Carolina" });
    expect(practiceMatchProblems({ ...audit, domain: "www.EdgewaterVet.com/", state: "South Carolina" }, r)).toEqual([]);
  });

  it("says nothing when there's nothing to compare (older audits, no listing, no state)", () => {
    expect(practiceMatchProblems(audit, {} as AuditResults)).toEqual([]);
    expect(practiceMatchProblems({ ...audit, state: null }, results({ listingAddress: "Orlando, FL 32810" }))).toEqual([]);
  });

  it("doesn't flag a home page that names no state", () => {
    expect(practiceMatchProblems(audit, results({}, home("Edgewater Animal Hospital", "Caring for dogs and cats.")))).toEqual([]);
  });
});
