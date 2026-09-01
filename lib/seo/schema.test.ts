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
  it("reports nothing when every expectation is met", () => {
    const gaps = findSchemaGaps(["VeterinaryCare", "Organization", "WebSite", "BreadcrumbList"]);
    expect(gaps).toEqual([]);
  });

  it("flags a site with no markup at all, practice as critical", () => {
    const gaps = findSchemaGaps([]);
    expect(gaps).toHaveLength(4);
    const practice = gaps.find((g) => g.key === "practice");
    expect(practice?.severity).toBe("critical");
    expect(practice?.status).toBe("missing");
  });

  it("accepts LocalBusiness but suggests the more specific type", () => {
    const gaps = findSchemaGaps(["LocalBusiness", "Organization", "WebSite", "BreadcrumbList"]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      key: "practice",
      status: "imprecise",
      found: "LocalBusiness",
      severity: "watch",
    });
    expect(gaps[0].suggestion).toContain("VeterinaryCare");
  });

  it("does not nag when both the generic and specific types are present", () => {
    const gaps = findSchemaGaps([
      "LocalBusiness",
      "VeterinaryCare",
      "Organization",
      "WebSite",
      "BreadcrumbList",
    ]);
    expect(gaps).toEqual([]);
  });

  it("matches type names case-insensitively", () => {
    const gaps = findSchemaGaps(["veterinarycare", "organization", "website", "breadcrumblist"]);
    expect(gaps).toEqual([]);
  });
});
