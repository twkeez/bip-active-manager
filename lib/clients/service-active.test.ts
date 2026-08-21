import { describe, expect, it } from "vitest";
import { isServiceActive, isLowContact, isLowContactTier } from "@/lib/clients/service-active";

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

describe("isLowContact", () => {
  it("uses the dedicated column when it is set", () => {
    expect(isLowContact({ tier: null, is_low_contact: true })).toBe(true);
    expect(isLowContact({ tier: "Growth", is_low_contact: true })).toBe(true);
  });

  it("lets the column override a stale tier value", () => {
    expect(isLowContact({ tier: "Low Contact", is_low_contact: false })).toBe(false);
  });

  // Keeps working before the column is backfilled, and after tier is cleared.
  it("falls back to the tier text while the column is absent", () => {
    expect(isLowContact({ tier: "Low Contact" })).toBe(true);
    expect(isLowContact({ tier: "low contact", is_low_contact: null })).toBe(true);
    expect(isLowContact({ tier: "Growth" })).toBe(false);
    expect(isLowContact({ tier: null })).toBe(false);
  });
});
