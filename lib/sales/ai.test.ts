import { describe, expect, it } from "vitest";
import { buildHostingerHorizonsPrompt } from "./prompt";

const baseInput = {
  prospectName: "Northside Vet",
  prospectUrl: "https://examplevet.com",
  seo: {
    normalized_url: "https://examplevet.com",
    title: "Northside Vet",
    title_length: 13,
    meta_description: "Compassionate pet care.",
    meta_description_length: 23,
    h1_count: 1,
    canonical: "https://examplevet.com",
    robots_meta: null,
    has_json_ld_schema: true,
    schema_types: ["LocalBusiness"],
    has_sitemap_hint: true,
    has_robots_txt_hint: true,
    issues: [
      {
        id: "missing-h1",
        severity: "critical" as const,
        title: "Missing H1",
        description: "No H1 heading found.",
        recommendation: "Add H1",
      },
    ],
  },
  lighthouseScores: {
    performance: 59,
    seo: 71,
    accessibility: 78,
    bestPractices: 83,
  },
  lighthouseMetrics: {
    fcp: "2.3s",
    lcp: "4.9s",
    cls: "0.31",
    tbt: "210ms",
    speedIndex: "5.1s",
  },
  lighthouseFindings: [
    {
      id: "render-blocking",
      title: "Eliminate render-blocking resources",
      description: "Reduce blocking CSS.",
      display_value: "1,200 ms",
      score: 0.1,
      severity: "critical" as const,
    },
  ],
};

describe("buildHostingerHorizonsPrompt", () => {
  it("uses extracted evidence when available", () => {
    const prompt = buildHostingerHorizonsPrompt({
      ...baseInput,
      extractedSiteContext: {
        scannedUrls: 4,
        sourceUrls: ["https://examplevet.com", "https://examplevet.com/reviews"],
        valueProps: [
          {
            text: "Compassionate same-day appointments in Fort Myers.",
            sourceUrl: "https://examplevet.com",
          },
        ],
        reviews: [
          {
            text: "They treated my dog like family and explained every step clearly.",
            sourceUrl: "https://examplevet.com/reviews",
          },
        ],
        services: ["Emergency care", "Dental cleaning"],
        ctas: ["Book Appointment", "Call Now"],
        contactPoints: ["(239) 555-1212", "Naples, FL 34102"],
        serviceAreas: ["Naples"],
        trustSignals: ["25 years", "family-owned"],
        reasonsToChoose: ["Lead with same-day urgent care credibility."],
        missingSections: [],
        crawlDiagnostics: {
          attemptedUrls: 4,
          skippedUrls: 0,
          skippedByReason: {},
        },
      },
      brief: {
        targetKeyword: "vet clinic in Naples",
        competitorUrl: "https://competitorvet.com",
        valueProposition: "Friendly same-day care.",
        clientTestimonial: "They cared for our pet like family.",
        crawlMode: "all_pages",
        maxPages: 50,
        promptStyle: "full",
        logoSource: "url",
        competitorGaps: ["Competitor has a weaker FAQ experience."],
      },
    });
    expect(prompt).toContain("Compassionate same-day appointments in Fort Myers.");
    expect(prompt).toContain("They treated my dog like family");
    expect(prompt).toContain("Missing extracted sections: none");
    expect(prompt).toContain("Required constraints checklist");
    expect(prompt).toContain("Visual direction block");
    expect(prompt).toContain("Page structure block");
    expect(prompt).toContain("sales-demo website concept");
    expect(prompt).toContain("Target keyword: vet clinic in Naples");
    expect(prompt).toContain("LocalBusiness schema placeholders");
    expect(prompt).toContain("Build action:");
    expect(prompt).toContain("[high]");
    expect(prompt).toContain("[medium]");
    expect(prompt).toContain("exact brand mark in header and footer");
    expect(prompt).toContain("Color palette to apply");
    expect(prompt).not.toContain("Current Lighthouse baseline");
    expect(prompt).not.toContain("Observed audit issues to address");
    expect(prompt).not.toContain("local-business SEO essentials");
  });

  it("inserts placeholders when extracted evidence is missing", () => {
    const prompt = buildHostingerHorizonsPrompt({
      ...baseInput,
      extractedSiteContext: {
        scannedUrls: 0,
        sourceUrls: [],
        valueProps: [],
        reviews: [],
        services: [],
        ctas: [],
        contactPoints: [],
        serviceAreas: [],
        trustSignals: [],
        reasonsToChoose: [],
        missingSections: ["valueProps", "reviews", "services", "trustSignals"],
        crawlDiagnostics: {
          attemptedUrls: 0,
          skippedUrls: 0,
          skippedByReason: {},
        },
      },
    });
    expect(prompt).toContain("[PLACEHOLDER]");
    expect(prompt).toContain("Missing extracted sections: valueProps, reviews, services, trustSignals");
    expect(prompt).toContain("Placeholder fallback block");
    expect(prompt).toContain("Demo handoff block");
    expect(prompt).toContain("[placeholder]");
  });

  it("prefers higher conversion snippets and stays deterministic", () => {
    const input = {
      ...baseInput,
      extractedSiteContext: {
        scannedUrls: 6,
        sourceUrls: ["https://examplevet.com"],
        valueProps: [
          { text: "Welcome to our website.", sourceUrl: "https://examplevet.com" },
          {
            text: "Book same-day emergency appointments with trusted local vets.",
            sourceUrl: "https://examplevet.com",
          },
          {
            text: "Call now for urgent pet care and board-certified treatment.",
            sourceUrl: "https://examplevet.com",
          },
          { text: "Compassionate care for your pets.", sourceUrl: "https://examplevet.com" },
          { text: "Quality service.", sourceUrl: "https://examplevet.com" },
        ],
        reviews: [],
        services: [
          "Emergency exams",
          "Dental cleaning",
          "Wellness visits",
          "Boarding",
          "Surgery",
          "Generic page",
          "Pet care service",
        ],
        ctas: ["Learn more", "Book Appointment", "Call Now", "Request Consultation", "Read blog"],
        contactPoints: ["(239) 555-1212"],
        serviceAreas: ["Naples", "Bonita Springs", "Fort Myers", "Estero", "Marco Island"],
        trustSignals: ["25 years", "family-owned", "award-winning", "accredited", "local clinic"],
        reasonsToChoose: ["Experienced team", "Fast appointments"],
        missingSections: [],
        crawlDiagnostics: {
          attemptedUrls: 8,
          skippedUrls: 2,
          skippedByReason: { lowValuePath: 2 },
        },
      },
      brief: {
        targetKeyword: "emergency vet naples",
        competitorUrl: "https://competitorvet.com",
        valueProposition: null,
        clientTestimonial: null,
        crawlMode: "all_pages" as const,
        maxPages: 50,
        promptStyle: "full" as const,
        logoSource: "none" as const,
        competitorGaps: ["Place CTA modules above the fold and in footer."],
      },
    };

    const promptA = buildHostingerHorizonsPrompt(input);
    const promptB = buildHostingerHorizonsPrompt(input);
    expect(promptA).toBe(promptB);
    expect(promptA).toContain("Industry detected: vet");
    expect(promptA).toContain("Existing CTA to reuse or improve: Book Appointment");
    expect(promptA).not.toContain("Quality service.");
    expect(promptA).toContain("Build action: Place CTA modules above the fold and in footer.");
    expect(promptA).toContain("HOSTINGER HORIZONS MASTER PROMPT");
    expect(promptA.split("\n").length).toBeLessThanOrEqual(88);
  });

  it("returns short production format when requested", () => {
    const prompt = buildHostingerHorizonsPrompt({
      ...baseInput,
      extractedSiteContext: {
        scannedUrls: 1,
        sourceUrls: ["https://examplevet.com"],
        valueProps: [{ text: "Compassionate same-day pet care.", sourceUrl: "https://examplevet.com" }],
        reviews: [],
        services: ["Emergency care", "Dental cleaning"],
        ctas: ["Book Appointment"],
        contactPoints: ["(239) 555-1212"],
        serviceAreas: ["Naples"],
        trustSignals: [],
        reasonsToChoose: [],
        missingSections: [],
        crawlDiagnostics: { attemptedUrls: 1, skippedUrls: 0, skippedByReason: {} },
      },
      brief: {
        targetKeyword: "vet clinic in Naples",
        competitorUrl: null,
        valueProposition: null,
        clientTestimonial: null,
        crawlMode: "all_pages",
        maxPages: 50,
        promptStyle: "short",
        logoSource: "none",
        competitorGaps: [],
      },
    });
    expect(prompt).toContain("HOSTINGER HORIZONS MASTER PROMPT");
    expect(prompt).toContain("NON-NEGOTIABLE RULES");
    expect(prompt).toContain("exact brand mark in header and footer");
    expect(prompt).toContain("Color palette to apply");
    expect(prompt).toContain("OUTPUT FORMAT");
    expect(prompt).not.toContain("Prompt blocks:");
  });
});
