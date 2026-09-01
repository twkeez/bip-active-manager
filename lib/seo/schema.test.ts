import { describe, expect, it } from "vitest";
import { extractSchemaTypes, findSchemaGaps } from "@/lib/seo/schema";

const wrap = (json: string) => `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`;

describe("extractSchemaTypes", () => {
  it("reads a plain @type", () => {
    expect(extractSchemaTypes(wrap('{"@type":"VeterinaryCare"}'))).toEqual(["VeterinaryCare"]);
  });

  it("reads types out of the @graph wrapper Yoast and RankMath emit", () => {
    const html = wrap('{"@graph":[{"@type":"Organization"},{"@type":"WebSite"}]}');
    expect(extractSchemaTypes(html).sort()).toEqual(["Organization", "WebSite"]);
  });

  it("handles an array of @type values", () => {
    const html = wrap('{"@type":["LocalBusiness","VeterinaryCare"]}');
    expect(extractSchemaTypes(html).sort()).toEqual(["LocalBusiness", "VeterinaryCare"]);
  });

  it("survives the invalid JSON real sites ship", () => {
    // Banner comment, block comment and a trailing comma — all things lenient
    // validators accept and JSON.parse does not.
    const messy = `
      // Schema by SomePlugin v3
      /* do not edit */
      {"@type":"VeterinaryCare","name":"Test",}
    `;
    expect(extractSchemaTypes(wrap(messy))).toEqual(["VeterinaryCare"]);
  });

  it("returns nothing for a page with no markup, without throwing", () => {
    expect(extractSchemaTypes("<html><body>hi</body></html>")).toEqual([]);
    expect(extractSchemaTypes(wrap("{ genuinely broken"))).toEqual([]);
  });
});

describe("findSchemaGaps", () => {
  const COMPLETE = ["VeterinaryCare", "LocalBusiness", "Organization", "WebSite", "BreadcrumbList"];

  it("reports nothing when the practice has both types and the rest", () => {
    expect(findSchemaGaps(COMPLETE)).toEqual([]);
  });

  it("flags a site with no markup at all, local business as critical", () => {
    const gaps = findSchemaGaps([]);
    expect(gaps).toHaveLength(5);
    const local = gaps.find((g) => g.key === "local_business");
    expect(local?.severity).toBe("critical");
    expect(local?.status).toBe("missing");
  });

  // The correction that prompted this: VeterinaryCare descends from
  // MedicalOrganization, not LocalBusiness, so on its own it publishes no
  // opening hours or location. It must not read as "the practice is marked up".
  it("treats VeterinaryCare alone as an unpaired critical gap", () => {
    const gaps = findSchemaGaps(["VeterinaryCare", "Organization", "WebSite", "BreadcrumbList"]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      key: "local_business",
      severity: "critical",
      status: "unpaired",
      found: "VeterinaryCare",
    });
    expect(gaps[0].suggestion).toContain("LocalBusiness");
  });

  it("never suggests replacing LocalBusiness with VeterinaryCare", () => {
    const gaps = findSchemaGaps(["LocalBusiness", "Organization", "WebSite", "BreadcrumbList"]);
    // The only gap is the missing vet type, and it is advisory, not critical.
    expect(gaps.map((g) => g.key)).toEqual(["veterinary_care"]);
    expect(gaps[0].severity).toBe("watch");
    expect(gaps.some((g) => g.key === "local_business")).toBe(false);
  });

  it("accepts any LocalBusiness descendant for the local business slot", () => {
    for (const type of ["MedicalBusiness", "MedicalClinic", "EmergencyService"]) {
      const gaps = findSchemaGaps([type, "VeterinaryCare", "Organization", "WebSite", "BreadcrumbList"]);
      expect(gaps, `${type} should satisfy the local business expectation`).toEqual([]);
    }
  });

  it("matches type names case-insensitively", () => {
    expect(findSchemaGaps(COMPLETE.map((t) => t.toLowerCase()))).toEqual([]);
  });
});
