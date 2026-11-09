import { describe, expect, it } from "vitest";
import { technicalFindings } from "@/lib/website-audit/findings";
import { summarize } from "@/lib/website-audit/crawl";
import type { CrawlPage, SitemapGap, TechnicalCrawl } from "@/lib/website-audit/types";

const page = (path: string, over: Partial<CrawlPage> = {}): CrawlPage =>
  ({
    url: `https://www.vet.com${path}`,
    finalUrl: `https://www.vet.com${path}`,
    host: "www.vet.com",
    sitemap: "https://www.vet.com/sitemap.xml",
    chain: [{ url: `https://www.vet.com${path}`, status: 200 }],
    redirectLoop: false,
    finalStatus: 200,
    error: null,
    archiveType: null,
    softError: null,
    title: `Title of ${path}`,
    metaDescription: "A summary",
    h1s: ["One headline"],
    wordCount: 600,
    canonical: `https://www.vet.com${path}`,
    schemaTypes: ["WebPage"],
    hasViewport: true,
    links: [],
    navLinks: [],
    text: "",
    ...over,
  }) as CrawlPage;

const crawl = (pages: CrawlPage[], notInSitemap: SitemapGap[] = []): TechnicalCrawl =>
  ({ pages, notInSitemap, slashVariants: [], summary: summarize(pages, "vet.com"), robotsTxt: {}, llmsTxt: {}, stoppedBecause: "done" }) as unknown as TechnicalCrawl;

const find = (t: TechnicalCrawl, start: string) => technicalFindings(t).find((f) => f.text.includes(start))!;

describe("finding details", () => {
  it("names each page and what's wrong there", () => {
    const t = crawl([page("/a", { h1s: ["Pet Surgery", "in Indian Land"] }), page("/b", { wordCount: 120, metaDescription: null })]);
    expect(find(t, "more than one main headline").details).toEqual([
      { url: "https://www.vet.com/a", note: "2 main headlines (H1)", items: ["Pet Surgery", "in Indian Land"] },
    ]);
    expect(find(t, "under 300 words").details).toEqual([{ url: "https://www.vet.com/b", note: "120 words" }]);
    expect(find(t, "no summary").details?.[0].url).toBe("https://www.vet.com/b");
  });

  it("leads a broken link with the page it sits on", () => {
    const post = page("/blog/award/", { links: ["https://www.vet.com/blog/award/gbj.com/vote"] });
    const t = crawl([post, page("/")], [{ url: "https://www.vet.com/blog/award/gbj.com/vote", linkedFrom: [post.url], finalStatus: 404, softError: null }]);
    expect(find(t, "lead to pages that don't load").details).toEqual([
      { url: "https://www.vet.com/blog/award/", note: 'A link goes to https://www.vet.com/blog/award/gbj.com/vote, which is "page not found" (404).' },
    ]);
  });

  it("names the bad link's words and place, and spots a link written without https://", () => {
    const target = "https://www.vet.com/blog/award/gbj.com/vote";
    const post = page("/blog/award/", { links: [target], anchors: [{ url: target, href: "gbj.com/vote", text: "Vote here", area: "body" }] });
    const t = crawl([post, page("/")], [{ url: target, linkedFrom: [post.url], finalStatus: 404, softError: null }]);
    expect(find(t, "lead to pages that don't load").details![0].note).toBe(
      `The "Vote here" link in the page text goes to ${target}, which is "page not found" (404). It's written as "gbj.com/vote", without https://, so browsers open it as a page on your own site.`,
    );
  });

  it("says a link on every page is in the menu or footer instead of listing them all", () => {
    const pages = ["/", "/a", "/b", "/c", "/d"].map((p) => page(p, { links: ["https://www.vet.com/privacy"] }));
    const t = crawl(pages, [{ url: "https://www.vet.com/privacy", linkedFrom: [], finalStatus: 200, softError: null }]);
    const d = find(t, "missing from your sitemap").details![0];
    expect(d.note).toContain("Linked from 5 pages, so it's in the menu or footer");
    expect(d.linkedFrom).toBeUndefined();
  });

  it("lists who links to a page missing from the site, with the sitemap that lists it", () => {
    const t = crawl([page("/gone", { finalStatus: 404 }), page("/", { links: ["https://vet.com/gone/"] })]);
    const d = find(t, "pages are missing").details![0];
    expect(d.note).toContain("Listed in your sitemap (https://www.vet.com/sitemap.xml)");
    expect(d.linkedFrom).toEqual(["https://www.vet.com/"]);
  });
});
