import { describe, expect, it } from "vitest";
import { countSignificantFluctuations } from "@/lib/seo/rank-fluctuations";
import type { KeywordHealthRow } from "@/lib/types/client";

describe("countSignificantFluctuations", () => {
  it("counts tracked keywords with >=5 position swing", () => {
    const rows: KeywordHealthRow[] = [
      {
        keyword: "vet near me",
        page_url: "https://example.com",
        current_position: 8,
        previous_position: 14,
        position_delta: -6,
        current_clicks: 1,
        previous_clicks: 2,
        current_impressions: 100,
        previous_impressions: 90,
        dropped_by_3_plus: true,
      },
    ];
    const result = countSignificantFluctuations(rows, [
      { keyword: "vet near me", is_active: true },
    ]);
    expect(result.tracked).toBe(1);
  });
});
