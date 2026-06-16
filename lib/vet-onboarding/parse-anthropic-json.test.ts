import { describe, expect, it } from "vitest";
import { parseAnthropicJson } from "@/lib/vet-onboarding/parse-anthropic-json";

describe("parseAnthropicJson", () => {
  it("extracts JSON after prose preamble", () => {
    const raw = `Based on a review of the local market, here is the data:

{"competitors":[{"name":"A","note":"B"}],"marketSnapshot":"Growing","searchLandscape":"Competitive"}`;

    const result = parseAnthropicJson<{
      marketSnapshot: string;
    }>(raw, "research");

    expect(result.marketSnapshot).toBe("Growing");
  });
});
