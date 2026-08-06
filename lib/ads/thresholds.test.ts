import { describe, expect, it } from "vitest";
import {
  LOST_BUDGET_CRITICAL,
  LOST_BUDGET_WATCH,
  LOST_RANK_CRITICAL,
  LOST_RANK_WATCH,
  lostIsCritical,
  lostIsWatch,
} from "@/lib/ads/thresholds";

describe("ads impression-share thresholds", () => {
  it("keeps watch tiers below critical tiers", () => {
    expect(LOST_BUDGET_WATCH).toBeLessThan(LOST_BUDGET_CRITICAL);
    expect(LOST_RANK_WATCH).toBeLessThan(LOST_RANK_CRITICAL);
  });

  it("selects the right tier per metric", () => {
    expect(lostIsWatch("budget")).toBe(LOST_BUDGET_WATCH);
    expect(lostIsWatch("rank")).toBe(LOST_RANK_WATCH);
    expect(lostIsCritical("budget")).toBe(LOST_BUDGET_CRITICAL);
    expect(lostIsCritical("rank")).toBe(LOST_RANK_CRITICAL);
  });
});
