import { describe, expect, it } from "vitest";
import { bandFor, computeScore } from "./score";
import { pageTypeOf } from "./content";
import type { AuditResults } from "./types";

describe("citability score", () => {
  it("bands", () => {
    expect([bandFor(30), bandFor(45), bandFor(70), bandFor(80)]).toEqual(["Limited", "Developing", "Established", "Strong"]);
  });

  it("splits outside authority into reviews (12) and DataForSEO rank (8), and always adds up to its parts", () => {
    const results = {
      authority: {
        own: { rank: 125 },
        google: { rating: 4.9, reviewCount: 500 },
      },
    } as unknown as AuditResults;
    const s = computeScore(results);
    expect(s.subScores.find((p) => p.key === "reviews")).toMatchObject({ weight: 12, points: 12 });
    expect(s.subScores.find((p) => p.key === "domainRank")).toMatchObject({ weight: 8, points: 4 });
    expect(s.subScores.reduce((sum, p) => sum + p.weight, 0)).toBe(100);
    expect(s.total).toBe(Math.round(s.subScores.reduce((sum, p) => sum + p.points, 0)));
  });

  it("classifies page types from the address", () => {
    const t = (path: string) => pageTypeOf({ finalUrl: `https://www.example.com${path}` });
    expect([t("/"), t("/services/surgery.html"), t("/staff/"), t("/about/"), t("/blog/why-is-my-dog-limping/"), t("/blog/tag/x/"), t("/faqs/")]).toEqual([
      "home", "service", "team", "about", "blog_post", "other", "other",
    ]);
    // Edgewater: services under /veterinary-services/, articles at the top level labelled as blog posts.
    expect(t("/veterinary-services/dental-care.html")).toBe("service");
    expect(t("/veterinary-services")).toBe("other");
    expect(pageTypeOf({ finalUrl: "https://www.example.com/fungal-skin-infections-in-dogs", schemaTypes: ["BlogPosting"] })).toBe("blog_post");
    expect(pageTypeOf({ finalUrl: "https://www.example.com/faqs", schemaTypes: ["FAQPage"] })).toBe("other");
  });
});
