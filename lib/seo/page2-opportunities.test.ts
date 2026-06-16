import { describe, expect, it } from "vitest";
import { buildPage2Opportunities } from "@/lib/seo/page2-opportunities";

describe("buildPage2Opportunities", () => {
  it("filters positions 11-20 by impressions", () => {
    const rows = buildPage2Opportunities([
      { query: "vet near me", impressions: 500, clicks: 2, position: 12.4 },
      { query: "page one", impressions: 900, clicks: 40, position: 4.2 },
      { query: "low volume", impressions: 10, clicks: 0, position: 15 },
      { query: "deep page", impressions: 200, clicks: 1, position: 22 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.query).toBe("vet near me");
  });
});
