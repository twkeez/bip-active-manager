import { describe, expect, it } from "vitest";
import {
  addressFromText,
  collectJsonLdNodes,
  countDoctors,
  detectPlatforms,
  detectProcedures,
  detectSocialLinks,
  detectSpecializations,
  detectTrackingTags,
  extractPrefillFromPages,
  findBusinessNode,
  formatJsonLdAddress,
  practiceNameFromTitle,
} from "@/lib/strategy-mapper/prefill-from-url";

const HOMEPAGE = `
<html>
  <head>
    <title>Bayside Animal Hospital | Veterinarian in Howell, NJ</title>
    <meta property="og:site_name" content="Bayside Animal Hospital" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", "name": "Bayside site" },
          {
            "@type": "VeterinaryCare",
            "name": "Bayside Animal Hospital",
            "telephone": "(732) 555-0184",
            "logo": { "url": "/img/logo.png" },
            "aggregateRating": { "ratingValue": "4.9", "reviewCount": "312" },
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "123 Main St",
              "addressLocality": "Howell",
              "addressRegion": "NJ",
              "postalCode": "07731"
            }
          }
        ]
      }
    </script>
    <script>window.dataLayer=[];gtag('config','AW-123456789');gtag('config','G-ABC123XYZ');</script>
  </head>
  <body class="wp-content">
    <h1>Compassionate care for dogs and cats in Howell</h1>
    <p>We offer orthopedic surgery including TPLO, digital radiography, and dental cleaning for pets across Monmouth County every single day of the week.</p>
    <a href="https://www.facebook.com/baysideanimal">Facebook</a>
    <a href="https://www.instagram.com/baysideanimal">Instagram</a>
    <a href="/about-us/">About Us</a>
    <a href="/our-team/">Our Team</a>
    <a href="/blog/puppy-tips">Blog</a>
    <img src="/img/logo.png" alt="Bayside Animal Hospital logo" />
  </body>
</html>`;

const TEAM_PAGE = `
<html><head><title>Our Team</title></head><body>
  <h2>Dr. Jane Smith, DVM</h2><p>Owner and founding veterinarian.</p>
  <h2>Dr. Alan Vasquez, DVM</h2>
  <h2>Dr. Priya Raman</h2>
  <p>Our exotic and avian patients are seen by Dr. Raman.</p>
</body></html>`;

describe("practiceNameFromTitle", () => {
  it("keeps the first meaningful title segment", () => {
    expect(practiceNameFromTitle("Bayside Animal Hospital | Veterinarian in Howell, NJ")).toBe(
      "Bayside Animal Hospital",
    );
  });

  it("skips a leading Home segment", () => {
    expect(practiceNameFromTitle("Home | Riverbend Veterinary Clinic")).toBe(
      "Riverbend Veterinary Clinic",
    );
  });

  it("handles a title with no separators", () => {
    expect(practiceNameFromTitle("Riverbend Veterinary Clinic")).toBe("Riverbend Veterinary Clinic");
  });
});

describe("JSON-LD parsing", () => {
  it("follows @graph and picks the most specific business node", () => {
    const nodes = collectJsonLdNodes(HOMEPAGE);
    const business = findBusinessNode(nodes);
    expect(business?.name).toBe("Bayside Animal Hospital");
  });

  it("formats a PostalAddress into the single-line form the mapper expects", () => {
    const business = findBusinessNode(collectJsonLdNodes(HOMEPAGE));
    expect(formatJsonLdAddress(business)).toBe("123 Main St, Howell, NJ 07731");
  });

  it("ignores malformed JSON-LD instead of throwing", () => {
    const nodes = collectJsonLdNodes(
      '<script type="application/ld+json">{ not json }</script>',
    );
    expect(nodes).toEqual([]);
  });

  it("returns nothing when the address lacks a street", () => {
    expect(formatJsonLdAddress({ address: { addressLocality: "Howell" } })).toBe("");
  });
});

describe("addressFromText", () => {
  it("finds a US street address in footer text", () => {
    expect(addressFromText("Visit us at 4820 Oakhurst Ave, Toms River, NJ 08753 today")).toBe(
      "4820 Oakhurst Ave, Toms River, NJ 08753",
    );
  });

  it("returns empty when there is no address", () => {
    expect(addressFromText("Call us today for an appointment")).toBe("");
  });
});

describe("signal detection", () => {
  it("maps site copy onto the fixed specialization list", () => {
    const found = detectSpecializations(
      "We treat dogs and cats, exotic pets and birds, with 24/7 emergency care and orthopedic surgery.",
    );
    expect(found).toContain("Small Animal");
    expect(found).toContain("Exotic / Avian");
    expect(found).toContain("24/7 Emergency");
    expect(found).toContain("Orthopedics / Specialty");
    expect(found).not.toContain("Equine / Large Animal");
  });

  it("names high-ticket procedures", () => {
    const found = detectProcedures("We perform TPLO, dental cleaning, and cold laser therapy.");
    expect(found).toEqual(
      expect.arrayContaining(["TPLO", "Dental cleaning & extractions", "Laser therapy"]),
    );
  });

  it("counts unique doctors and ignores repeats", () => {
    expect(countDoctors("Dr. Jane Smith and Dr. Smith run the practice with Dr. Alan Vasquez.")).toBe("2");
  });

  it("refuses an implausible doctor count", () => {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const many = Array.from(
      { length: 60 },
      (_, i) => `Dr. ${letters[i % 26].toUpperCase()}${letters[Math.floor(i / 26)]}stonbury`,
    ).join(" ");
    expect(countDoctors(many)).toBe("");
  });

  it("prefers a vet vendor over the generic CMS", () => {
    expect(detectPlatforms('<div>ivet360</div><link href="/wp-content/x.css">')[0]).toBe("iVET360");
  });

  it("flags a Google Ads conversion tag", () => {
    expect(detectTrackingTags("gtag('config','AW-123456789')")).toContain(
      "Google Ads conversion tag",
    );
  });

  it("ignores share links when picking social profiles", () => {
    expect(
      detectSocialLinks(["https://facebook.com/sharer/sharer.php?u=x", "https://instagram.com/clinic"]),
    ).toEqual(["Instagram"]);
  });
});

describe("extractPrefillFromPages", () => {
  const result = extractPrefillFromPages([
    { url: "https://baysidevet.com/", html: HOMEPAGE },
    { url: "https://baysidevet.com/our-team/", html: TEAM_PAGE },
  ]);

  it("pulls the practice name and address from structured data", () => {
    expect(result.practiceName).toBe("Bayside Animal Hospital");
    expect(result.streetAddress).toBe("123 Main St, Howell, NJ 07731");
  });

  it("resolves the logo and phone", () => {
    expect(result.logoUrl).toBe("/img/logo.png");
    expect(result.signals.phone).toBe("(732) 555-0184");
  });

  it("reads specializations across every scanned page", () => {
    expect(result.specializations).toContain("Small Animal");
    expect(result.specializations).toContain("Exotic / Avian");
  });

  it("counts doctors from the team page", () => {
    expect(result.doctorCount).toBe("3");
  });

  it("captures the ad and social footprint", () => {
    expect(result.signals.trackingTags).toContain("Google Ads conversion tag");
    expect(result.signals.socialLinks[0]).toBe("Facebook");
  });

  it("records the site's claimed rating without treating it as a form value", () => {
    expect(result.signals.claimedRating).toBe("4.9");
    expect(result.signals.claimedReviewCount).toBe("312");
  });

  it("condenses page text for the AI pass", () => {
    expect(result.condensedText).toContain("https://baysidevet.com/our-team/");
    expect(result.condensedText.length).toBeLessThanOrEqual(14000);
  });

  it("returns an empty shape when nothing was crawled", () => {
    const empty = extractPrefillFromPages([]);
    expect(empty.practiceName).toBe("");
    expect(empty.signals.trackingTags).toEqual([]);
  });
});
