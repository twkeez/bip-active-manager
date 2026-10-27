import { describe, expect, it } from "vitest";
import { analyzeHtml, bareDomain, summarize } from "./crawl";
import type { CrawlPage } from "./types";

const html = `<html><head><title>Dog Dental Care in Powder Springs</title>
<meta name="description" content="Dental cleanings for dogs and cats.">
<link rel="canonical" href="https://www.example.com/dental/">
<meta name="viewport" content="width=device-width">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"VeterinaryCare"},{"@type":"FAQPage"}]}</script>
</head><body><nav><a href="/services/">Services</a></nav><h1>Dental care</h1><h1>Dental care</h1><h2>Why</h2><p>Clean teeth matter for pets.</p>
<script>var x = "not text";</script></body></html>`;

describe("website audit crawl", () => {
  it("normalises a domain", () => {
    expect(bareDomain("https://www.DHAH.org/about/")).toBe("dhah.org");
  });

  it("reads a page's technical signals", () => {
    const page = analyzeHtml(html, "https://www.example.com/dental");
    expect(page.title).toBe("Dog Dental Care in Powder Springs");
    expect(page.h1s).toEqual(["Dental care", "Dental care"]);
    expect(page.h2Count).toBe(1);
    expect(page.canonicalMatches).toBe(false);
    expect(page.canonicalMatchesIgnoringSlash).toBe(true);
    expect(page.schemaTypes.sort()).toEqual(["FAQPage", "VeterinaryCare"]);
    expect(page.hasViewport).toBe(true);
    expect(page.text).not.toContain("not text");
    expect(page.navLinks[0]).toEqual({ text: "Services", href: "/services/" });
  });

  it("counts the bare and www copies of a page once, and flags http downgrades", () => {
    const base = analyzeHtml(html, "https://www.example.com/dental/");
    const page = (url: string, chain: CrawlPage["chain"]): CrawlPage => ({
      ...base, url, host: new URL(url).host, sitemap: "s", chain, redirectLoop: false,
      finalUrl: chain.at(-1)!.url, finalStatus: 200, error: null, archiveType: null,
    });
    const s = summarize(
      [
        page("https://example.com/dental/", [
          { url: "https://example.com/dental/", status: 301 },
          { url: "http://www.example.com/dental/", status: 301 },
          { url: "https://www.example.com/dental/", status: 200 },
        ]),
        page("https://www.example.com/dental/", [{ url: "https://www.example.com/dental/", status: 200 }]),
      ],
      "example.com",
    );
    expect(s.totalUrls).toBe(2);
    expect(s.uniquePages).toBe(1);
    expect(s.byHost).toEqual({ "example.com": 1, "www.example.com": 1 });
    expect(s.insecureRedirects).toEqual(["https://example.com/dental/"]);
    expect(s.repeatedH1OnPage).toEqual(["https://example.com/dental/"]);
    expect(s.duplicateH1AcrossPages).toEqual([]);
  });
});
