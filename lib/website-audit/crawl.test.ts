import { describe, expect, it } from "vitest";
import { isListingPage } from "./archive";
import { analyzeHtml, bareDomain, pageKey, softErrorOf, summarize } from "./crawl";
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
      finalUrl: chain.at(-1)!.url, finalStatus: 200, error: null, archiveType: null, softError: null,
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

describe("error pages served as 200", () => {
  it("recognises dhah.org's redirect-loop page and PHP errors", () => {
    const loop = "<pre style='background:#111'>SELF-REDIRECT LOOP DETECTED\nCurrent:  https://www.dhah.org/blog/hello-world\nBacktrace:\n#0 /var/www/x/public_html/blog/wp-includes/class-wp-hook.php:353";
    expect(softErrorOf(loop)).toBe("redirect-loop");
    expect(softErrorOf("<b>Fatal error</b>: Uncaught Error in /wp-content/x.php")).toBe("server-error");
    expect(softErrorOf(html)).toBeNull();
  });
});

describe("sitemap gaps", () => {
  it("compares pages ignoring www and the trailing slash, and keeps only same-site page links", () => {
    expect(pageKey("https://www.dhah.org/blog/post")).toBe(pageKey("https://dhah.org/blog/post/"));
    const page = analyzeHtml(
      '<a href="/blog/a/">A</a><a href="https://www.example.com/b#x">B</a><a href="https://other.com/c">C</a><a href="/img.jpg">I</a><a href="/blog/page/2/">2</a><a href="/?p=1">p</a>',
      "https://example.com/",
    );
    expect(page.links).toEqual(["https://example.com/blog/a/", "https://www.example.com/b"]);
  });
});

describe("isListingPage", () => {
  it("spots WordPress listing pages, not posts", () => {
    for (const url of [
      "https://www.dhah.org/blog/2024/11/",
      "https://www.dhah.org/blog/2025/",
      "https://www.dhah.org/blog/tag/dental-care/",
      "https://www.dhah.org/blog/category/news-events/",
      "https://www.dhah.org/blog/page/2/",
      "https://www.dhah.org/feed/",
    ])
      expect(isListingPage(url)).toBe(true);
    for (const url of ["https://www.dhah.org/blog/skin-allergies-that-dont-respond-to-treatment/", "https://www.dhah.org/services/surgery.html", "https://www.dhah.org/"])
      expect(isListingPage(url)).toBe(false);
  });
});
