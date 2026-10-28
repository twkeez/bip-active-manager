import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { anthropicClient, costOf } from "@/lib/ai/usage";
import { stripLoneSurrogates } from "@/lib/text/strip-lone-surrogates";
import type {
  AuditResults,
  CrawlPage,
  PageContent,
  PageType,
  SiteContent,
  ContentResults,
} from "@/lib/website-audit/types";

// Section 4: content and trust signals. Haiku reads each real page (not tag,
// category or date archives) with a prompt for its type; Opus then reads
// everything Haiku found, the Google reviews and the other sections, and
// writes the differentiators, positioning, homepage H1 and ranked fix list.
// Every claim it makes must cite a page URL or a review.

const PAGE_MODEL = "claude-haiku-5-5";
const SITE_MODEL = "claude-opus-5-5";
const CONCURRENCY = 6;

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };
const priceOf = (model: string, usage: Usage) =>
  costOf({
    model,
    input: usage.input_tokens,
    output: usage.output_tokens,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
    webSearches: 0,
  });

export function pageTypeOf(page: Pick<CrawlPage, "finalUrl">): PageType {
  const path = new URL(page.finalUrl).pathname.toLowerCase();
  if (path === "/" || path === "") return "home";
  if (/\/(services?|treatments?)\/./.test(path)) return "service";
  if (/(staff|team|doctors?|veterinarians|\/dr-)/.test(path)) return "team";
  if (/\/about/.test(path)) return "about";
  if (/^\/blog\/(?!tag\/|category\/|author\/|page\/|\d{4}\/)[^/]+\/?$/.test(path)) return "blog_post";
  return "other";
}

/** Pages worth reading: real 200 pages, once each, without archives. */
export function pagesToRead(pages: CrawlPage[]): CrawlPage[] {
  const seen = new Set<string>();
  return pages.filter((p) => {
    if (p.finalStatus !== 200 || p.softError || p.archiveType || !p.text) return false;
    if (/\/(blog\/)?\d{4}\/\d{2}\/?$|\/blog\/?$/.test(new URL(p.finalUrl).pathname)) return false;
    if (seen.has(p.finalUrl)) return false;
    seen.add(p.finalUrl);
    return true;
  });
}

const TYPE_FOCUS: Record<PageType, string> = {
  home: "This is the homepage: note the main message, any tagline, and everything about who the practice is, hours, booking and trust signals.",
  service: "This is a service page: note which services it actually describes and whether it explains them with real content.",
  team: "This is a team page: list every doctor named, their credentials exactly as written, whether they have a bio of their own, and any school or graduation year stated.",
  about: "This is an about page: note history, ownership, accreditations, and anything that makes the practice distinctive.",
  blog_post: "This is a blog post: note whether its main heading is phrased as a question, whether an author is named, whether a date is shown, and whether it links to one of the practice's service pages.",
  other: "Note anything useful about the practice: hours, booking, payment, emergencies, prices, accreditations, FAQs.",
};

const nullableString = { type: ["string", "null"] } as const;
const pageSchema = {
  type: "object",
  properties: {
    doctors: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, credentials: nullableString, hasBio: { type: "boolean" }, school: nullableString, year: nullableString },
        required: ["name", "credentials", "hasBio", "school", "year"],
        additionalProperties: false,
      },
    },
    servicesNamed: { type: "array", items: { type: "string" } },
    hours: nullableString,
    booking: nullableString,
    emergencyReferral: nullableString,
    paymentInfo: nullableString,
    pricesShown: { type: "array", items: { type: "string" } },
    accreditations: { type: "array", items: { type: "string" } },
    hasFaq: { type: "boolean" },
    // The API rejects type: ["object", "null"]; a nullable object has to be anyOf.
    blog: {
      anyOf: [
        {
          type: "object",
          properties: {
            questionHeading: { type: "boolean" },
            authorNamed: nullableString,
            dateShown: nullableString,
            linksToServicePage: { type: "boolean" },
          },
          required: ["questionHeading", "authorNamed", "dateShown", "linksToServicePage"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    typos: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, suggestion: { type: "string" }, where: { type: "string" } },
        required: ["text", "suggestion", "where"],
        additionalProperties: false,
      },
    },
    recommendedH1: { type: "string" },
    secondaryLine: nullableString,
  },
  required: [
    "doctors", "servicesNamed", "hours", "booking", "emergencyReferral", "paymentInfo", "pricesShown",
    "accreditations", "hasFaq", "blog", "typos", "recommendedH1", "secondaryLine",
  ],
  additionalProperties: false,
} as const;

type Practice = { practiceName: string; city: string | null; state: string | null; domain: string };

function pagePrompt(page: CrawlPage, type: PageType, practice: Practice, serviceUrls: string[]): string {
  const town = [practice.city, practice.state].filter(Boolean).join(", ");
  return `You are auditing a veterinary practice's website for an agency report. Read this one page and report only what is on it. Do not guess or add anything that isn't written there.

Practice: ${practice.practiceName}${town ? `, ${town}` : ""}
Page URL: ${page.finalUrl}
Page title: ${page.title ?? "(none)"}
H1 headings: ${page.h1s.length ? page.h1s.map((h) => `"${h}"`).join(", ") : "(none)"}
Menu links: ${page.navLinks.slice(0, 40).map((l) => `${l.text} → ${l.href}`).join("; ") || "(none)"}
${type === "blog_post" ? `Links on this page to service pages: ${page.links.filter((l) => serviceUrls.includes(l.replace(/\/$/, ""))).join(", ") || "(none)"}` : ""}

${TYPE_FOCUS[type]}

Also:
- Doctors: only veterinarians (DVM/VMD) named on this page. Credentials exactly as written ("DVM", "Doctor of Veterinary Medicine"…). hasBio is true only if this page has a paragraph about that doctor.
- servicesNamed: the veterinary services this page names (short names).
- hours, booking method, emergency referral, payment information: as written, or null.
- pricesShown: any prices, e.g. wellness plan prices.
- accreditations: AAHA, Fear Free, Cat Friendly Practice / AAFP, or others named.
- hasFaq: true if the page has questions with answers.
- blog: only for a blog post, otherwise null.
- typos: spelling mistakes in the URL, title, headings, menu or text (e.g. "opthalmology", or a misspelled town). "where" says which: url, title, heading, menu or text.
- recommendedH1: one H1 for this page following the pattern "{what} {for whom} in {city}", e.g. "Dog and Cat Dental Care in ${practice.city ?? "Town"}". secondaryLine: the page's existing tagline or H1 if worth keeping as a line under it, else null.

Page text:
${page.text}`;
}

const siteSchema = {
  type: "object",
  properties: {
    differentiators: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          evidence: {
            type: "array",
            items: { type: "object", properties: { source: { type: "string" }, quote: { type: "string" } }, required: ["source", "quote"], additionalProperties: false },
          },
        },
        required: ["title", "detail", "evidence"],
        additionalProperties: false,
      },
    },
    positioningLine: { type: "string" },
    homepageH1: { type: "string" },
    fixes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rank: { type: "number" },
          fix: { type: "string" },
          whyItMatters: { type: "string" },
          area: { type: "string", enum: ["technical", "content", "trust", "ai_visibility", "reputation", "conversion"] },
          evidence: {
            type: "array",
            items: { type: "object", properties: { source: { type: "string" }, quote: { type: "string" } }, required: ["source", "quote"], additionalProperties: false },
          },
        },
        required: ["rank", "fix", "whyItMatters", "area", "evidence"],
        additionalProperties: false,
      },
    },
    servicesWithoutPage: { type: "array", items: { type: "string" } },
    menuItemsGoingNowhere: { type: "array", items: { type: "string" } },
    hoursContradictions: { type: "array", items: { type: "string" } },
  },
  required: ["differentiators", "positioningLine", "homepageH1", "fixes", "servicesWithoutPage", "menuItemsGoingNowhere", "hoursContradictions"],
  additionalProperties: false,
} as const;

/** The other sections, condensed for the site-level pass. */
function siteFacts(results: AuditResults, pages: PageContent[], servicePages: string[]): string {
  const t = results.technical?.summary;
  const a = results.authority;
  const v = results.aiVisibility;
  const brokenMenu = (results.technical?.notInSitemap ?? []).filter((g) => g.finalStatus !== 200 || g.softError).map((g) => g.url);
  return JSON.stringify(
    {
      technical: t && {
        sitemapUrls: t.totalUrls,
        byHost: t.byHost,
        distinctPages: t.uniquePages,
        tagPages: t.tagPages,
        blogPostsBreakWithoutTrailingSlash: t.slashVariants.loops.length,
        insecureRedirects: t.insecureRedirects.length + t.slashVariants.insecure.length,
        pagesMissingCanonical: t.missingCanonicalUrls,
        pagesWithSchema: t.withSchema,
        schemaTypes: t.schemaTypes,
        homepageH1Repeated: t.repeatedH1OnPage,
        missingMetaDescriptions: t.missingMetaDescription,
        helloWorldPostInSitemap: t.helloWorldInSitemap,
        linkedPagesMissingFromSitemap: (results.technical?.notInSitemap ?? []).filter((g) => g.finalStatus === 200 && !g.softError).map((g) => g.url),
        linksThatDontLoad: brokenMenu,
        llmsTxt: Object.values(results.technical?.llmsTxt ?? {}).some(Boolean),
      },
      servicePages,
      authority: a && {
        dataForSeoRank: a.own.rank,
        referringDomains: a.own.referringDomains,
        googleRating: a.google.rating,
        googleReviewCount: a.google.reviewCount,
      },
      aiVisibility: v && {
        promptsAsked: v.prompts.length,
        perPlatform: v.platforms.map((p) => ({ platform: p.label, cited: p.promptsCited, named: p.promptsMentioned, answered: p.promptsAnswered })),
        citedForInformationalQuestions: v.runs.some((r) => r.cited && v.prompts.find((p) => p.id === r.promptId)?.kind === "informational"),
        sitesAiCitesInstead: v.topCitedDomains.slice(0, 8),
      },
      pages: pages.map(({ error, ...p }) => p),
      googleReviews: (a?.google.reviews ?? []).map((r, i) => ({ id: `review ${i + 1}`, rating: r.rating, date: r.date?.slice(0, 10), text: r.text })),
    },
    null,
    0,
  );
}

function sitePrompt(practice: Practice, facts: string): string {
  return `You are writing the strategy section of a website, SEO and AI-search audit for ${practice.practiceName} (${[practice.city, practice.state].filter(Boolean).join(", ")}; ${practice.domain}), a veterinary practice. The reader is the practice owner: plain English, no jargon.

Below is everything the audit found, as JSON: technical crawl results, authority, AI visibility, what was read on each page, and the 20 newest Google reviews.

Write:
1. differentiators: 4 to 6 things the website should lead with. Each must be supported by something written on the site or said in a review. For each, give evidence: source is the page URL, or "review N"; quote is the exact words. Do not invent anything the evidence doesn't show.
2. positioningLine: one sentence the practice could use to describe itself.
3. homepageH1: a homepage H1 in the pattern "{what} {for whom} in {city}".
4. fixes: a prioritized fix list, most impact first (rank 1 = do first), 6 to 10 items. "whyItMatters" is one plain sentence a practice owner understands. Each fix cites its evidence (a page URL or a data point from the JSON, e.g. "technical.blogPostsBreakWithoutTrailingSlash: 10"). area is technical, content, trust, ai_visibility, reputation or conversion.
5. servicesWithoutPage: services named somewhere on the site that have no page of their own (compare pages[].servicesNamed with servicePages).
6. menuItemsGoingNowhere: menu items whose link doesn't lead to a working page (use the menu links in pages and technical.linksThatDontLoad).
7. hoursContradictions: places where pages state different hours. Empty if they agree.

Audit data:
${facts}`;
}

async function readPage(page: CrawlPage, practice: Practice, serviceUrls: string[], spend: { usd: number }): Promise<PageContent> {
  const type = pageTypeOf(page);
  const base = { url: page.finalUrl, pageType: type, currentH1: page.h1s[0] ?? null };
  try {
    const message = await anthropicClient("Website audit: content (pages)").messages.parse({
      model: PAGE_MODEL,
      max_tokens: 8000,
      output_config: { effort: "low", format: jsonSchemaOutputFormat(pageSchema) },
      messages: [{ role: "user", content: stripLoneSurrogates(pagePrompt(page, type, practice, serviceUrls)) }],
    });
    spend.usd += priceOf(PAGE_MODEL, message.usage);
    if (message.stop_reason === "max_tokens" || !message.parsed_output) throw new Error("Claude's answer for this page was cut off or unreadable.");
    const parsed = message.parsed_output as Omit<PageContent, "url" | "pageType" | "currentH1" | "error">;
    // Claude occasionally "corrects" a word to itself; those aren't typos.
    const typos = parsed.typos.filter((t) => t.text.trim().toLowerCase() !== t.suggestion.trim().toLowerCase() && !/no typo|placeholder/i.test(t.suggestion));
    return { ...base, ...parsed, typos, blog: type === "blog_post" ? parsed.blog : null, error: null };
  } catch (error) {
    return {
      ...base,
      doctors: [], servicesNamed: [], hours: null, booking: null, emergencyReferral: null, paymentInfo: null, pricesShown: [],
      accreditations: [], hasFaq: false, blog: null, typos: [], recommendedH1: "", secondaryLine: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Runs Section 4. Needs the crawl; uses authority and AI visibility when present. */
export async function analyzeContent(practice: Practice, results: AuditResults): Promise<ContentResults> {
  const crawl = results.technical;
  if (!crawl) throw new Error("Run the technical crawl first: the content pass reads the pages it found.");
  const toRead = pagesToRead(crawl.pages);
  const servicePages = toRead.filter((p) => pageTypeOf(p) === "service").map((p) => p.finalUrl.replace(/\/$/, ""));

  const spend = { usd: 0 };
  const pages: PageContent[] = new Array(toRead.length);
  let next = 0;
  async function worker() {
    while (next < toRead.length) {
      const index = next;
      next += 1;
      pages[index] = await readPage(toRead[index], practice, servicePages, spend);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // A pass where Claude couldn't read most pages would score the site as having
  // no doctors, FAQs or blog: fail instead of saving a wrong picture.
  const failed = pages.filter((p) => p.error);
  if (failed.length > pages.length / 4) {
    throw new Error(`Claude couldn't read ${failed.length} of ${pages.length} pages (${failed[0].error?.slice(0, 160)}). Nothing was saved; run the step again.`);
  }

  let site: SiteContent;
  try {
    const message = await anthropicClient("Website audit: content (site)").messages.parse({
      model: SITE_MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: jsonSchemaOutputFormat(siteSchema) },
      messages: [{ role: "user", content: stripLoneSurrogates(sitePrompt(practice, siteFacts(results, pages, servicePages))) }],
    });
    spend.usd += priceOf(SITE_MODEL, message.usage);
    if (message.stop_reason === "max_tokens" || !message.parsed_output) throw new Error("Claude's site-level answer was cut off or unreadable.");
    site = { ...(message.parsed_output as Omit<SiteContent, "error">), error: null };
  } catch (error) {
    site = {
      differentiators: [], positioningLine: "", homepageH1: "", fixes: [], servicesWithoutPage: [], menuItemsGoingNowhere: [], hoursContradictions: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
  if (site.error) throw new Error(`The site-level pass failed (${site.error.slice(0, 160)}). Nothing was saved; run the step again.`);
  site.fixes.sort((a, b) => a.rank - b.rank);

  return { ranAt: new Date().toISOString(), pageModel: PAGE_MODEL, siteModel: SITE_MODEL, pages, site, costUsd: Number(spend.usd.toFixed(4)) };
}
