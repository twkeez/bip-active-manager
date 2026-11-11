import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditResults, CrawlPage, TechnicalCrawl } from "@/lib/website-audit/types";

// Counts every paid call the content step makes, so the tests can prove a page that hasn't changed isn't read twice.
const calls = { page: 0, site: 0 };
vi.mock("@/lib/ai/usage", () => ({
  costOf: () => 0.01,
  anthropicClient: (label: string) => ({
    messages: {
      parse: async () => {
        const site = label.includes("(site)");
        if (site) calls.site += 1;
        else calls.page += 1;
        return {
          usage: { input_tokens: 1, output_tokens: 1 },
          stop_reason: "end_turn",
          parsed_output: site
            ? { differentiators: [], positioningLine: `plan ${calls.site}`, homepageH1: "", fixes: [], servicesWithoutPage: [], menuItemsGoingNowhere: [], hoursContradictions: [] }
            : { doctors: [], servicesNamed: [`reading ${calls.page}`], hours: null, booking: null, emergencyReferral: null, paymentInfo: null, pricesShown: [], accreditations: [], hasFaq: false, blog: null, typos: [], recommendedH1: "", secondaryLine: null },
        };
      },
    },
  }),
}));

const { analyzeContent } = await import("@/lib/website-audit/content");
const { summarize } = await import("@/lib/website-audit/crawl");

const page = (path: string, text: string): CrawlPage =>
  ({
    url: `https://www.vet.com${path}`,
    finalUrl: `https://www.vet.com${path}`,
    host: "www.vet.com",
    sitemap: "https://www.vet.com/sitemap.xml",
    chain: [{ url: `https://www.vet.com${path}`, status: 200 }],
    redirectLoop: false,
    finalStatus: 200,
    error: null,
    softError: null,
    archiveType: null,
    title: `Title ${path}`,
    metaDescription: "A summary",
    h1s: ["Headline"],
    wordCount: 600,
    canonical: `https://www.vet.com${path}`,
    hasViewport: true,
    navLinks: [],
    links: [],
    schemaTypes: [],
    text,
  }) as unknown as CrawlPage;

const practice = { practiceName: "Vet", city: "Town", state: "GA", domain: "vet.com" };
const crawl = (...pages: CrawlPage[]) =>
  ({ technical: { pages, summary: summarize(pages, "vet.com"), notInSitemap: [], slashVariants: [], robotsTxt: {}, llmsTxt: {} } as unknown as TechnicalCrawl }) as AuditResults;

describe("the content step reuses what it has already read", () => {
  beforeEach(() => {
    calls.page = 0;
    calls.site = 0;
  });

  it("reads every page the first time, and nothing the second time when nothing changed", async () => {
    const results = crawl(page("/", "Home text"), page("/about/", "About text"));
    const first = await analyzeContent(practice, results);
    expect(calls).toEqual({ page: 2, site: 1 });
    expect(first.pagesReused).toBe(0);

    const second = await analyzeContent(practice, { ...results, content: first });
    expect(calls).toEqual({ page: 2, site: 1 });
    expect(second.pagesReused).toBe(2);
    expect(second.siteReused).toBe(true);
    expect(second.costUsd).toBe(0);
    expect(second.pages.map((p) => p.servicesNamed)).toEqual(first.pages.map((p) => p.servicesNamed));
    expect(second.site.positioningLine).toBe(first.site.positioningLine);
  });

  it("re-reads only the page that changed, and then writes a new plan", async () => {
    const first = await analyzeContent(practice, crawl(page("/", "Home text"), page("/about/", "About text")));
    const second = await analyzeContent(practice, { ...crawl(page("/", "Home text"), page("/about/", "About text, now with laser therapy")), content: first });
    expect(calls).toEqual({ page: 3, site: 2 });
    expect(second.pagesReused).toBe(1);
    expect(second.siteReused).toBe(false);
    expect(second.pages[0].servicesNamed).toEqual(first.pages[0].servicesNamed);
  });

  it("keeps readings from the last audit of the same website", async () => {
    const earlier = await analyzeContent(practice, crawl(page("/", "Home text")));
    const fresh = await analyzeContent(practice, crawl(page("/", "Home text")), earlier);
    expect(calls.page).toBe(1);
    expect(fresh.pagesReused).toBe(1);
    // A new audit writes its own plan: its other sections (AI answers, reviews) are its own.
    expect(fresh.siteReused).toBe(false);
  });
});
