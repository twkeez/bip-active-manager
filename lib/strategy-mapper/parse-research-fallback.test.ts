import { describe, expect, it } from "vitest";
import { parseResearchFromText } from "@/lib/strategy-mapper/parse-research-fallback";

const validResearchJson = `{
  "densityTier": "suburban",
  "wellnessRadiusMiles": 5,
  "specialtyRadiusMiles": null,
  "specialtyRadiusEnabled": false,
  "radiusRationale": "Suburban default",
  "clientMetrics": { "googleRating": 4.2, "reviewCount": 120, "runsGoogleAds": true },
  "competitors": [
    {
      "name": "Local Vet",
      "distanceMiles": 3.1,
      "googleRating": 4.5,
      "reviewCount": 0,
      "runsGoogleAds": false,
      "scope": "local"
    }
  ]
}`;

describe("parseResearchFromText", () => {
  it("parses raw JSON text into StrategyMapperResearch", () => {
    const parsed = parseResearchFromText(validResearchJson);
    expect(parsed?.clientMetrics.reviewCount).toBe(120);
    expect(parsed?.competitors[0]?.reviewCount).toBe(0);
  });

  it("parses JSON wrapped in markdown fences", () => {
    const parsed = parseResearchFromText(`Here is the data:\n\`\`\`json\n${validResearchJson}\n\`\`\``);
    expect(parsed?.densityTier).toBe("suburban");
  });

  it("returns null for invalid payloads", () => {
    expect(parseResearchFromText('{"densityTier":"invalid"}')).toBeNull();
    expect(parseResearchFromText("not json")).toBeNull();
  });
});
