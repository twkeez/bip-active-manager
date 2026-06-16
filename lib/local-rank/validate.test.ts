import { describe, expect, it } from "vitest";
import {
  normalizeGridSize,
  normalizeKeywords,
  plannedApiCalls,
} from "@/lib/local-rank/validate";

describe("normalizeKeywords", () => {
  it("deduplicates and trims keywords", () => {
    expect(normalizeKeywords([" vet near me ", "vet near me", "animal hospital"])).toEqual([
      "vet near me",
      "animal hospital",
    ]);
  });

  it("rejects more than 3 keywords", () => {
    expect(() =>
      normalizeKeywords(["one", "two", "three", "four"]),
    ).toThrow("Maximum 3 keywords per run.");
  });

  it("requires at least one keyword", () => {
    expect(() => normalizeKeywords(["", "  "])).toThrow("At least one keyword is required.");
  });
});

describe("normalizeGridSize", () => {
  it("accepts the default 5×5 grid", () => {
    expect(normalizeGridSize(5)).toBe(5);
  });

  it("rejects other grid sizes", () => {
    expect(() => normalizeGridSize(4)).toThrow("Grid size must be 5 (25 points).");
  });
});

describe("plannedApiCalls", () => {
  it("computes keyword × grid point budget", () => {
    expect(plannedApiCalls(3)).toBe(75);
    expect(plannedApiCalls(1)).toBe(25);
  });
});
