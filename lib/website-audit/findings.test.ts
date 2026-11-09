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
    expect(find(t, "doesn't load").details).toEqual([
      { url: "https://www.vet.com/blog/award/", note: 'A link goes to https://www.vet.com/blog/award/gbj.com/vote, which is "page not found" (404).' },
    ]);
  });

  it("names the bad link's words and place, and spots a link written without https://", () => {
    const target = "https://www.vet.com/blog/award/gbj.com/vote";
    const post = page("/blog/award/", { links: [target], anchors: [{ url: target, href: "gbj.com/vote", text: "Vote here", area: "body" }] });
    const t = crawl([post, page("/")], [{ url: target, linkedFrom: [post.url], finalStatus: 404, softError: null }]);
    expect(find(t, "doesn't load").details![0].note).toBe(
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
    const d = find(t, "missing (\"page not found\")").details![0];
    expect(d.note).toContain("Listed in your sitemap (https://www.vet.com/sitemap.xml)");
    expect(d.linkedFrom).toEqual(["https://www.vet.com/"]);
  });

  it("puts red first, says how to fix each problem, and gets 1 vs many right", () => {
    const post = page("/blog/a/", { links: ["https://www.vet.com/gone"] });
    const t = crawl([page("/"), post], [{ url: "https://www.vet.com/gone", linkedFrom: [post.url], finalStatus: 404, softError: null }]);
    const all = technicalFindings(t);
    expect(all[0].tone).toBe("bad");
    expect(all[0].text).toBe("1 link on your site leads to a page that doesn't load.");
    expect(all[0].fix).toContain("Change each link");
    expect(all.filter((f) => f.tone !== "good").every((f) => f.fix)).toBe(true);
  });

  it("collapses many addresses missing the final \"/\" that go via http into one entry", () => {
    const variants = ["about", "faqs", "staff"].map((p) => ({
      pageUrl: `https://www.vet.com/${p}/`,
      variantUrl: `https://www.vet.com/${p}`,
      chain: [
        { url: `https://www.vet.com/${p}`, status: 301 },
        { url: `http://www.vet.com/${p}/`, status: 301 },
        { url: `https://www.vet.com/${p}/`, status: 200 },
      ],
    }));
    const t = crawl([page("/")]);
    t.slashVariants = variants as TechnicalCrawl["slashVariants"];
    t.summary.slashVariants = { ...t.summary.slashVariants, insecure: variants.map((v) => v.variantUrl) };
    const d = find(t, "insecure (http)").details!;
    expect(d).toHaveLength(1);
    expect(d[0].label).toBe('3 addresses typed without the final "/"');
    expect(d[0].items).toEqual(variants.map((v) => v.variantUrl));
  });

  it("shortens a long linked-from list and spots a sitemap that isn't adding blog posts", () => {
    const posts = ["a", "b", "c", "d", "e", "f"].map((p) => page(`/blog/${p}/`, { links: ["https://www.vet.com/blog/new/", "https://www.vet.com/blog/newer/"] }));
    const others = ["/", "/x", "/y", "/z", "/w", "/v"].map((p) => page(p));
    const gap = (u: string) => ({ url: u, linkedFrom: [], finalStatus: 200, softError: null });
    const t = crawl([...posts, ...others], [gap("https://www.vet.com/blog/new/"), gap("https://www.vet.com/blog/newer/")]);
    const f = find(t, "missing from your sitemap");
    expect(f.fix).toContain("all blog posts");
    expect(f.details![0].linkedFrom).toHaveLength(4);
    expect(f.details![0].linkedFrom![3]).toBe("and 3 more pages");
  });

  it("calls a live Hello world post a leftover, not a sitemap gap", () => {
    const t = crawl([page("/")], [{ url: "https://www.vet.com/blog/hello-world/", linkedFrom: [], finalStatus: 200, softError: null }]);
    expect(technicalFindings(t).some((f) => f.text.includes("missing from your sitemap"))).toBe(false);
    expect(find(t, "Hello world").text).toBe('The "Hello world!" sample post that comes with WordPress is still on the site.');
  });
});
