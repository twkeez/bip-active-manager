import { describe, expect, it } from "vitest";
import { isServiceActive, isLowContactTier } from "@/lib/clients/service-active";

describe("isServiceActive", () => {
  it("treats N and 0 as inactive", () => {
    expect(isServiceActive("N")).toBe(false);
    expect(isServiceActive("0")).toBe(false);
    expect(isServiceActive(null)).toBe(false);
  });

  it("treats service tiers as active", () => {
    expect(isServiceActive("Foundation")).toBe(true);
    expect(isServiceActive("Premium Plus")).toBe(true);
    expect(isServiceActive("1")).toBe(true);
  });
});

describe("isLowContactTier", () => {
  it("detects low contact tier", () => {
    expect(isLowContactTier("Low Contact")).toBe(true);
    expect(isLowContactTier("Growth")).toBe(false);
  });
});
