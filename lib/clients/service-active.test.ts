import { describe, expect, it } from "vitest";
import { isServiceActive, isLowContact, isLowContactTier, isWebsiteOnly } from "@/lib/clients/service-active";

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

describe("isWebsiteOnly", () => {
  it("uses the dedicated column when it is set", () => {
    expect(isWebsiteOnly({ tier: null, is_website_only: true })).toBe(true);
    expect(isWebsiteOnly({ tier: "Website Only", is_website_only: false })).toBe(false);
  });

  it("falls back to the exact legacy tier value", () => {
    expect(isWebsiteOnly({ tier: "Website Only" })).toBe(true);
    expect(isWebsiteOnly({ tier: null })).toBe(false);
    expect(isWebsiteOnly({ tier: "Growth" })).toBe(false);
  });

  // The comparison it replaces was exact and case-sensitive, so these were
  // never hidden and must not start being hidden now.
  it("does not newly hide near-miss tier values", () => {
    for (const tier of ["website only", "WEBSITE ONLY", " Website Only", "Website-Only"]) {
      expect(isWebsiteOnly({ tier }), tier).toBe(false);
    }
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
