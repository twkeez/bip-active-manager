import { describe, expect, it } from "vitest";
import {
  formatUrlListForPrompt,
  joinUrlLines,
  normalizeUrl,
  splitUrlLines,
} from "@/lib/vet-onboarding/url-helpers";

describe("normalizeUrl", () => {
  it("returns empty string for blank input", () => {
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("   ")).toBe("");
  });

  it("prepends https when scheme is missing", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("www.example.com/path")).toBe(
      "https://www.example.com/path",
    );
  });

  it("preserves existing http or https scheme", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });
});

describe("splitUrlLines", () => {
  it("splits and normalizes multiline URLs", () => {
    expect(splitUrlLines("example.com\nhttps://maps.google.com/?cid=1")).toEqual(
      ["https://example.com", "https://maps.google.com/?cid=1"],
    );
  });

  it("filters empty lines", () => {
    expect(splitUrlLines("example.com\n\n\n")).toEqual(["https://example.com"]);
  });
});

describe("joinUrlLines", () => {
  it("joins URLs with newlines", () => {
    expect(joinUrlLines(["https://a.com", "https://b.com"])).toBe(
      "https://a.com\nhttps://b.com",
    );
  });
});

describe("formatUrlListForPrompt", () => {
  it("returns Not provided when empty", () => {
    expect(formatUrlListForPrompt("")).toBe("Not provided");
  });

  it("returns comma-separated normalized URLs", () => {
    expect(formatUrlListForPrompt("example.com\nmaps.google.com/?cid=1")).toBe(
      "https://example.com, https://maps.google.com/?cid=1",
    );
  });
});
