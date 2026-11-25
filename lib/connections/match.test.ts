import { describe, expect, it } from "vitest";
import {
  mergeOptions,
  normalizeStoredValue,
  siteHost,
  storedStatus,
  suggestOptions,
  validateChoice,
  type SourceOption,
} from "@/lib/connections/match";

const option = (value: string, label = value, usable = true): SourceOption => ({
  value,
  label,
  detail: null,
  readableBy: ["svc@example.iam.gserviceaccount.com"],
  usable,
});

describe("siteHost", () => {
  it("reads URL-prefix and domain properties alike", () => {
    expect(siteHost("https://www.pawsvc.com/")).toBe("pawsvc.com");
    expect(siteHost("sc-domain:pawsvc.com")).toBe("pawsvc.com");
    expect(siteHost("pawsvc.com")).toBe("pawsvc.com");
    expect(siteHost("")).toBeNull();
  });
});

describe("suggestOptions", () => {
  it("matches Search Console sites on the website's host", () => {
    const options = [option("https://other.com/"), option("sc-domain:pawsvc.com"), option("https://www.pawsvc.com/")];
    const picked = suggestOptions("search_console", { account_name: "Paws Veterinary Clinic", website: "https://pawsvc.com" }, options);
    expect(picked.map((o) => o.value)).toEqual(["https://www.pawsvc.com/", "sc-domain:pawsvc.com"]);
  });
  it("matches GA4 properties and Ads accounts on the name, and offers group look-alikes", () => {
    const options = [
      option("1", "RPVH - Rocklin Ranch"),
      option("2", "RPVH - Rocklin Ranch Urgent Care"),
      option("3", "Harmony Animal Hospital"),
    ];
    const picked = suggestOptions("ads", { account_name: "Rocklin Ranch", website: null }, options);
    expect(picked.map((o) => o.value).sort()).toEqual(["1", "2"]);
  });
  it("puts a listing our access can't read below one it can", () => {
    const options = [option("https://a.com/", "https://a.com/", false), option("sc-domain:a.com")];
    const picked = suggestOptions("search_console", { account_name: "A", website: "a.com" }, options);
    expect(picked[0]?.value).toBe("sc-domain:a.com");
  });
});

describe("validateChoice and normalizeStoredValue", () => {
  it("keeps GA4 to digits and Ads to 10 digits", () => {
    expect(validateChoice("ga4", "properties/123")).toEqual({ value: "123" });
    expect(validateChoice("ga4", "G-ABC123")).toHaveProperty("error");
    expect(validateChoice("ads", "123-456-7890")).toEqual({ value: "1234567890" });
    expect(validateChoice("ads", "Needs added")).toHaveProperty("error");
    expect(normalizeStoredValue("ads", "12345")).toBeNull();
  });
  it("accepts Search Console sites only in Google's two forms", () => {
    expect(validateChoice("search_console", "https://pawsvc.com/")).toEqual({ value: "https://pawsvc.com/" });
    expect(validateChoice("search_console", "sc-domain:pawsvc.com")).toEqual({ value: "sc-domain:pawsvc.com" });
    expect(validateChoice("search_console", "pawsvc.com")).toHaveProperty("error");
    expect(validateChoice("search_console", "")).toHaveProperty("error");
  });
});

describe("storedStatus", () => {
  const options = [option("123"), option("https://www.a.com/"), option("https://b.com/", "https://b.com/", false)];
  it("reports not set, invalid, readable and not readable", () => {
    expect(storedStatus("ga4", null, options)).toEqual({ state: "not_set" });
    expect(storedStatus("ga4", "G-ABC", options)).toEqual({ state: "invalid", stored: "G-ABC" });
    expect(storedStatus("ga4", "properties/123", options)).toMatchObject({ state: "readable", value: "123" });
    expect(storedStatus("ga4", "999", options)).toEqual({ state: "not_readable", value: "999" });
  });
  it("finds a Search Console site saved without www or its slash, as the sync does", () => {
    expect(storedStatus("search_console", "https://a.com", options)).toMatchObject({ state: "readable", value: "https://www.a.com/" });
  });
  it("tells a listed-but-unreadable site apart", () => {
    expect(storedStatus("search_console", "https://b.com/", options)).toMatchObject({ state: "listed_not_usable" });
  });
});

describe("mergeOptions", () => {
  it("lists each value once, with everyone who can read it", () => {
    const merged = mergeOptions([
      { identity: "login", options: [{ value: "x", label: "X", detail: null, usable: false }] },
      { identity: "svc", options: [{ value: "x", label: "X", detail: "acct", usable: true }, { value: "a", label: "A", detail: null, usable: true }] },
    ]);
    expect(merged.map((o) => o.value)).toEqual(["a", "x"]);
    expect(merged[1]).toMatchObject({ readableBy: ["login", "svc"], usable: true, detail: "acct" });
  });
});
