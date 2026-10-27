import { describe, expect, it } from "vitest";
import { summarizeSpend } from "./spend";

describe("AI spend summary", () => {
  it("groups this month by feature, most expensive first", () => {
    const now = new Date("2026-10-27T15:00:00Z");
    const row = (feature: string, cost: number, created_at = "2026-10-27T10:00:00Z") => ({
      created_at, feature, model: "claude-haiku-5-5", input_tokens: 100, output_tokens: 10, web_searches: 0, cost_usd: cost,
    });
    const s = summarizeSpend([row("A", 0.5), row("B", 2), row("A", 0.25), row("A", 9, "2026-09-30T23:00:00Z")], now);
    expect(s.byFeature.map((f) => [f.feature, f.calls])).toEqual([["B", 1], ["A", 2]]);
    expect(s.monthTotal).toBeCloseTo(2.75);
    expect(s.byDay).toHaveLength(14);
    expect(s.byDay.at(-1)).toEqual({ day: "2026-10-27", cost: 2.75 });
  });
});
