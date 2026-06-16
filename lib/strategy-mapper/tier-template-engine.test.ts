import { describe, expect, it } from "vitest";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";
import { DEFAULT_TIER_FALLBACKS } from "@/lib/strategy-mapper/tier-library";
import {
  buildActiveStrategyBlock,
  hasUnreplacedPlaceholders,
  interpolateTierText,
} from "@/lib/strategy-mapper/tier-template-engine";
import type { StrategyMapperFormData } from "@/types/strategy-mapper";

const form: StrategyMapperFormData = {
  practiceName: "Bayside Animal Hospital",
  practiceOwnerName: "Dr. Jane Smith",
  streetAddress: "123 Main St, Howell, NJ 07731",
  locationNotes: "Monmouth County",
  specializations: ["Small Animal", "Orthopedics / Specialty"],
  customSpecialization: "",
  activeServices: ["seo"],
  primaryGoal: "General new client acquisition / Market dominance",
  strategicContextNotes: "",
};

const radius = calculateDualRadius(form);
const ctx = { form, radius };

describe("interpolateTierText", () => {
  it("replaces practice and location placeholders", () => {
    const result = interpolateTierText(
      "Drive traffic to [Practice Name] in [City] within [Local Core Radius].",
      ctx,
    );
    expect(result).toContain("Bayside Animal Hospital");
    expect(result).toContain("Howell");
    expect(result).toContain("5-mile radius");
    expect(hasUnreplacedPlaceholders(result)).toBe(false);
  });

  it("replaces practice type placeholder", () => {
    const result = interpolateTierText("Mapped to [Practice Type] keywords.", ctx);
    expect(result).toContain("Small Animal");
    expect(result).toContain("Orthopedics / Specialty");
  });
});

describe("buildActiveStrategyBlock", () => {
  it("includes AEO tactic for SEO Premium Plus", () => {
    const tier = DEFAULT_TIER_FALLBACKS.find((t) => t.tierKey === "seo-premium-plus")!;
    const block = buildActiveStrategyBlock(tier, ctx);
    expect(block.tactics.some((t) => t.includes("AEO"))).toBe(true);
    expect(block.tactics.some((t) => t.includes("Bayside Animal Hospital"))).toBe(true);
  });
});
