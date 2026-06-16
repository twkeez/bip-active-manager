import { describe, expect, it } from "vitest";
import { extractSiteContentFromPages, resolveSalesExtractOptions } from "./site-content";

describe("extractSiteContentFromPages", () => {
  it("extracts reviews, value props, services, and trust signals", () => {
    const result = extractSiteContentFromPages([
      {
        url: "https://clinic.test/",
        html: `
          <html><body>
            <h1>Trusted emergency vet care in Naples</h1>
            <p>Same-day appointments from a family-owned local team.</p>
            <section id="testimonials">
              <blockquote>They saved our cat and treated us with kindness.</blockquote>
            </section>
            <h2>Emergency Care</h2>
            <h2>Dental Treatment</h2>
            <p>Serving pets for 20 years with board-certified vets.</p>
          </body></html>
        `,
      },
    ]);

    expect(result.scannedUrls).toBe(1);
    expect(result.valueProps.length).toBeGreaterThan(0);
    expect(result.reviews.length).toBeGreaterThan(0);
    expect(result.services).toContain("Emergency Care");
    expect(result.ctas).toEqual(expect.any(Array));
    expect(result.contactPoints).toEqual(expect.any(Array));
    expect(result.serviceAreas).toEqual(expect.any(Array));
    expect(result.trustSignals.some((row) => /years|family-owned|certified/i.test(row))).toBe(true);
    expect(result.reasonsToChoose.length).toBeGreaterThan(0);
    expect(result.missingSections.length).toBeLessThan(4);
    expect(result.crawlDiagnostics.attemptedUrls).toBe(1);
  });

  it("marks sections as missing when little usable content exists", () => {
    const result = extractSiteContentFromPages([
      {
        url: "https://clinic.test/",
        html: "<html><body><nav><a>Home</a><a>Contact</a></nav></body></html>",
      },
    ]);

    expect(result.valueProps).toHaveLength(0);
    expect(result.reviews).toHaveLength(0);
    expect(result.services).toHaveLength(0);
    expect(result.trustSignals).toHaveLength(0);
    expect(result.missingSections).toEqual(
      expect.arrayContaining(["valueProps", "reviews", "services", "trustSignals"]),
    );
  });

  it("clamps crawler settings to safe bounds", () => {
    expect(resolveSalesExtractOptions({ maxUrls: 2, timeoutMs: 1000 })).toMatchObject({
      maxUrls: 5,
      timeoutMs: 3000,
    });
    expect(resolveSalesExtractOptions({ maxUrls: 999, timeoutMs: 30000 })).toMatchObject({
      maxUrls: 120,
      timeoutMs: 15000,
    });
  });
});
