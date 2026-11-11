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
      { url: "https://www.vet.com/a", title: "Title of /a", note: "2 main headlines (H1)", items: ["Pet Surgery", "in Indian Land"] },
    ]);
    expect(find(t, "under 300 words").details).toEqual([{ url: "https://www.vet.com/b", title: "Title of /b", note: "120 words" }]);
    expect(find(t, "no summary").details?.[0].url).toBe("https://www.vet.com/b");
  });

  it("leads a broken link with the page it sits on", () => {
    const post = page("/blog/award/", { links: ["https://www.vet.com/blog/award/gbj.com/vote"] });
    const t = crawl([post, page("/")], [{ url: "https://www.vet.com/blog/award/gbj.com/vote", linkedFrom: [post.url], finalStatus: 404, softError: null }]);
    expect(find(t, "doesn't load").details).toEqual([
      { url: "https://www.vet.com/blog/award/", title: "Title of /blog/award/", note: 'A link goes to https://www.vet.com/blog/award/gbj.com/vote, which is "page not found" (404).' },
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

  it("gives the sentence around a broken link and the live page it probably meant", () => {
    const dead = "https://dhah.org/blogs/1105177-kittens-101";
    const post = page("/blog/early-care/", {
      links: [dead],
      anchors: [{ url: dead, href: dead, text: "a curious kitten", area: "body", context: "Whether you have a curious kitten or a senior dog, early care matters." }],
    });
    const t = crawl([post, page("/"), page("/blog/kittens-101/")], [{ url: dead, linkedFrom: [post.url], finalStatus: 404, softError: null }]);
    const d = find(t, "doesn't load").details![0];
    expect(d.title).toBe("Title of /blog/early-care/");
    expect(d.note).toContain('Search the page for: "Whether you have a curious kitten or a senior dog, early care matters."');
    expect(d.note).toContain("It probably should go to https://www.vet.com/blog/kittens-101/.");
  });

  it("says an address we tested ourselves isn't a link on the site", () => {
    const v = { pageUrl: "https://www.vet.com/about/", variantUrl: "https://www.vet.com/about", chain: [{ url: "https://www.vet.com/about", status: 301 }, { url: "http://www.vet.com/about/", status: 301 }, { url: "https://www.vet.com/about/", status: 200 }] };
    const t = crawl([page("/")]);
    t.slashVariants = [v] as TechnicalCrawl["slashVariants"];
    t.summary.slashVariants = { ...t.summary.slashVariants, insecure: [v.variantUrl] };
    expect(find(t, "insecure (http)").details![0].note).toContain("we typed it ourselves to test your server");
  });

  it("doesn't mistake a link to /about/ for a link to /about", () => {
    const v = { pageUrl: "https://www.vet.com/about/", variantUrl: "https://www.vet.com/about", chain: [{ url: "https://www.vet.com/about", status: 301 }, { url: "http://www.vet.com/about/", status: 301 }, { url: "https://www.vet.com/about/", status: 200 }] };
    const t = crawl([page("/", { links: ["https://www.vet.com/about/"] }), page("/x", { links: ["https://vet.com/about"] })]);
    t.slashVariants = [v] as TechnicalCrawl["slashVariants"];
    t.summary.slashVariants = { ...t.summary.slashVariants, insecure: [v.variantUrl] };
    expect(find(t, "insecure (http)").details![0].linkedFrom).toEqual(["https://www.vet.com/x"]);
  });
});

describe("likelyReplacement", () => {
  it("matches an old blog address to the same post's new one, and nothing loosely related", async () => {
    const { likelyReplacement } = await import("@/lib/website-audit/findings");
    const live = ["https://www.dhah.org/blog/anxiety-in-pets/", "https://www.dhah.org/blog/pet-dental-tips/", "https://www.dhah.org/services/wellness.html"];
    expect(likelyReplacement("https://dhah.org/blogs/1069277-anxiety-in-pets", live)).toBe("https://www.dhah.org/blog/anxiety-in-pets/");
    expect(likelyReplacement("https://dhah.org/blogs/1158083-the-importance-of-nutrition-in-your-cats-diet", live)).toBeNull();
  });
});

describe("crawlLimits", () => {
  it("passes on what the crawl recorded, and says when an old crawl recorded nothing", async () => {
    const { crawlLimits } = await import("@/lib/website-audit/findings");
    const t = crawl([page("/")]);
    expect(crawlLimits(t)).toEqual({ hit: [], recorded: false });
    t.limitsHit = ["Your pages link to 75 addresses that aren't in your sitemap; we checked the first 60."];
    expect(crawlLimits(t).hit).toHaveLength(1);
  });
});

describe("links to other websites", () => {
  it("leads a dead one with the page it sits on, and admits the ones it couldn't confirm", async () => {
    const { notChecked } = await import("@/lib/website-audit/findings");
    const t = crawl([page("/"), page("/links/")]);
    expect(notChecked(t)[0]).toContain("weren't checked on this run");
    t.external = {
      found: 12,
      checked: 12,
      unverified: 3,
      dead: [{ url: "https://oldinsurer.com/pets", why: "no-site", pages: 1, from: [{ page: "https://www.vet.com/links/", text: "Pet insurance", area: "body", context: "We recommend Pet insurance from OldInsurer." }] }],
    };
    const f = find(t, "link to another website is dead");
    expect(f.tone).toBe("bad");
    expect(f.details).toEqual([
      {
        url: "https://www.vet.com/links/",
        title: "Title of /links/",
        note: 'The "Pet insurance" link in the page text goes to https://oldinsurer.com/pets, which is a website that no longer exists. Search the page for: "We recommend Pet insurance from OldInsurer."',
      },
    ]);
    expect(notChecked(t)[0]).toContain("3 links to other websites couldn't be confirmed");
  });
});

describe("files and pages outside the sitemap", () => {
  it("reports a dead PDF under the page that links to it", () => {
    const t = crawl([page("/"), page("/forms/")]);
    t.files = { found: 3, checked: 3, unverified: 0, dead: [{ url: "https://www.vet.com/files/new-client.pdf", why: "not-found", pages: 1, from: [{ page: "https://www.vet.com/forms/", text: "New client form (PDF)", area: "body" }] }] };
    const f = find(t, "PDF, image or document on your site is dead");
    expect(f.details![0].url).toBe("https://www.vet.com/forms/");
    expect(f.details![0].note).toContain('The "New client form (PDF)" link in the page text goes to https://www.vet.com/files/new-client.pdf');
  });

  it("names the words of a broken link that sits on a page outside the sitemap", () => {
    const dead = "https://www.vet.com/old-page/";
    const post = "https://www.vet.com/blog/unlisted-post/";
    const t = crawl(
      [page("/")],
      [
        { url: post, linkedFrom: ["https://www.vet.com/"], finalStatus: 200, softError: null, title: "Unlisted Post - Vet" },
        { url: dead, linkedFrom: [post], finalStatus: 404, softError: null, from: [{ page: post, url: dead, href: "/old-page/", text: "our old page", area: "body", context: "Read our old page for more." }] },
      ],
    );
    const d = find(t, "doesn't load").details![0];
    expect(d).toMatchObject({ url: post, title: "Unlisted Post" });
    expect(d.note).toContain('The "our old page" link in the page text goes to');
    expect(d.note).toContain('Search the page for: "Read our old page for more."');
  });
});

describe("a crawl that read nothing", () => {
  it("says so in red instead of reporting a sitemap with 0 addresses", async () => {
    const { crawlLimits } = await import("@/lib/website-audit/findings");
    const t = crawl([]);
    t.sitemapErrors = ["No readable sitemap found on either host."];
    const all = technicalFindings(t);
    expect(all[0]).toMatchObject({ tone: "bad", details: [{ label: "No readable sitemap found on either host." }] });
    expect(all.some((f) => f.text.includes("has 0 addresses"))).toBe(false);
    expect(crawlLimits(t).hit[0]).toContain("No sitemap could be read");
  });
});

