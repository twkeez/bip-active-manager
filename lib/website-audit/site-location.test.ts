import { describe, expect, it } from "vitest";
import { isCanadian, locationFromHtml, splitTypedLocation } from "@/lib/website-audit/site-location";

describe("locationFromHtml", () => {
  it("reads the town and state from structured data", () => {
    const html = `<script type="application/ld+json">{"@type":"VeterinaryCare","address":{"@type":"PostalAddress","streetAddress":"5067 Dallas Hwy","addressLocality":"Powder Springs","addressRegion":"GA","postalCode":"30127"}}</script>`;
    expect(locationFromHtml(html)).toEqual({ city: "Powder Springs", state: "GA", country: "USA", source: "structured data" });
  });

  it("accepts a spelled-out state in structured data", () => {
    const html = `<script type="application/ld+json">[{"address":{"addressLocality":"Rockville","addressRegion":"Maryland"}}]</script>`;
    expect(locationFromHtml(html)?.state).toBe("MD");
  });

  it("reads a US address written in the footer", () => {
    const html = `<footer><p>Locally Owned in 5067 Dallas Hwy, Powder Springs, GA 30127</p></footer>`;
    expect(locationFromHtml(html)).toMatchObject({ city: "Powder Springs", state: "GA", country: "USA" });
  });

  it("reads a Canadian address and flags the country (Q1 Veterinary Hospital's footer)", () => {
    const html = `<div>Get In Touch</div><div>1392 Gerrard Street East, Toronto, ON M4L 1Z4, Canada</div>`;
    expect(locationFromHtml(html)).toMatchObject({ city: "Toronto", state: "ON", country: "Canada" });
  });

  it("ignores a ZIP that doesn't fit the country", () => {
    expect(locationFromHtml(`<p>12 Main St, Toronto, ON 30127</p>`)).toBeNull();
  });

  it("returns null when there's no address", () => {
    expect(locationFromHtml(`<p>Call us today!</p>`)).toBeNull();
  });

  it("picks the address written most often", () => {
    const html = `<p>1 A St, Marietta, GA 30060</p><p>9 B Rd, Powder Springs, GA 30127</p><p>9 B Rd, Powder Springs, GA 30127</p>`;
    expect(locationFromHtml(html)?.city).toBe("Powder Springs");
  });
});

describe("splitTypedLocation", () => {
  it("splits an old-style city box", () => {
    expect(splitTypedLocation("Oshawa, Ontario, Canada", null)).toEqual({ city: "Oshawa", state: "ON" });
    expect(splitTypedLocation("Parkville, MD", null)).toEqual({ city: "Parkville", state: "MD" });
  });
  it("keeps a plain town", () => {
    expect(splitTypedLocation("Powder Springs", "GA")).toEqual({ city: "Powder Springs", state: "GA" });
  });
});

describe("isCanadian", () => {
  it("flags Canadian practices", () => {
    expect(isCanadian("Oshawa, Ontario, Canada", null)).toBe(true);
    expect(isCanadian("Toronto", "ON")).toBe(true);
    expect(isCanadian("Powder Springs", "GA")).toBe(false);
    expect(isCanadian("Jenison", null)).toBe(false);
  });
});
