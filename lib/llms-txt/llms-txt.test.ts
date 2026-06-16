import { describe, expect, it } from "vitest";
import {
  collectFullTextUrls,
  collectIndexedUrls,
  formatLlmsFullTxt,
  formatLlmsTxt,
} from "@/lib/llms-txt/format";
import type { LlmsTxtCuration, PageSnapshot } from "@/lib/llms-txt/types";
import { domainFromWebsite, normalizeWebsite, sitemapUrlForWebsite } from "@/lib/llms-txt/website";

const sampleCuration: LlmsTxtCuration = {
  h1Title: "Howell Animal Hospital",
  blockquoteSummary: "Affordable TPLO and orthopedic surgery in Monmouth County, NJ.",
  guidanceNotes: "Important notes:\n- Regional draw up to 40 miles for TPLO pricing.",
  sections: [
    {
      name: "Services",
      links: [
        {
          title: "TPLO Surgery",
          url: "https://example.com/tplo",
          description: "Pricing, recovery, candidacy.",
          optional: false,
        },
      ],
    },
    {
      name: "Optional",
      links: [
        {
          title: "Blog",
          url: "https://example.com/blog",
          description: "News archive.",
          optional: true,
        },
      ],
    },
  ],
};

describe("formatLlmsTxt", () => {
  it("emits H1, blockquote, guidance, H2 sections, and Optional in spec order", () => {
    const output = formatLlmsTxt(sampleCuration);
    expect(output.startsWith("# Howell Animal Hospital\n")).toBe(true);
    expect(output).toContain("> Affordable TPLO");
    expect(output).toContain("Important notes:");
    expect(output).toContain("## Services");
    expect(output).toContain("- [TPLO Surgery](https://example.com/tplo): Pricing");
    expect(output).toContain("## Optional");
    expect(output).toContain("- [Blog](https://example.com/blog)");
  });
});

describe("formatLlmsFullTxt", () => {
  it("includes header and full page bodies for non-optional links", () => {
    const pages = new Map<string, PageSnapshot>([
      [
        "https://example.com/tplo",
        {
          url: "https://example.com/tplo",
          title: "TPLO Surgery",
          description: "",
          text: "TPLO costs half of regional hospitals.",
        },
      ],
    ]);

    const { content, urlsIncluded, truncated } = formatLlmsFullTxt(
      sampleCuration,
      pages,
      500_000,
    );

    expect(truncated).toBe(false);
    expect(urlsIncluded).toBe(1);
    expect(content).toContain("# Howell Animal Hospital");
    expect(content).toContain("TPLO costs half of regional hospitals.");
    expect(content).not.toContain("Blog archive body");
  });

  it("truncates when max bytes exceeded", () => {
    const bigCuration: LlmsTxtCuration = {
      ...sampleCuration,
      sections: [
        {
          name: "Services",
          links: [
            {
              title: "Page A",
              url: "https://example.com/a",
              description: "A",
              optional: false,
            },
            {
              title: "Page B",
              url: "https://example.com/b",
              description: "B",
              optional: false,
            },
          ],
        },
      ],
    };
    const pages = new Map<string, PageSnapshot>([
      ["https://example.com/a", { url: "https://example.com/a", title: "A", description: "", text: "A".repeat(5000) }],
      ["https://example.com/b", { url: "https://example.com/b", title: "B", description: "", text: "B".repeat(5000) }],
    ]);

    const { urlsIncluded, truncated } = formatLlmsFullTxt(bigCuration, pages, 2000);
    expect(truncated).toBe(true);
    expect(urlsIncluded).toBeLessThan(2);
  });
});

describe("collectIndexedUrls", () => {
  it("returns all curated link URLs", () => {
    expect(collectIndexedUrls(sampleCuration).sort()).toEqual(
      ["https://example.com/blog", "https://example.com/tplo"].sort(),
    );
  });
});

describe("collectFullTextUrls", () => {
  it("excludes optional-section links from primary full set order", () => {
    expect(collectFullTextUrls(sampleCuration)).toEqual(["https://example.com/tplo"]);
  });
});

describe("website helpers", () => {
  it("normalizes bare domains to https", () => {
    expect(normalizeWebsite("example.com")).toBe("https://example.com");
    expect(normalizeWebsite("https://example.com/")).toBe("https://example.com");
  });

  it("builds sitemap URL from website", () => {
    expect(sitemapUrlForWebsite("example.com")).toBe("https://example.com/sitemap.xml");
  });

  it("extracts hostname", () => {
    expect(domainFromWebsite("https://www.example.com/path")).toBe("www.example.com");
  });
});
