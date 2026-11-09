import { isListingPage } from "@/lib/website-audit/archive";
import type { CrawlPage, LinkAnchor, RedirectHop, TechnicalCrawl } from "@/lib/website-audit/types";

// Shared by the audit screen and the printed report (no server imports here).

/**
 * One place an issue shows up, so it can be found and fixed: the page (or, for
 * a headline used on several pages, the headline), what's wrong there, the
 * specifics (the headlines, the redirect steps) and the pages linking to it.
 */
export type FindingDetail = { url?: string; label?: string; note?: string; items?: string[]; linkedFrom?: string[] };

/** `fix`: what to do about it, in a line a web developer (or the practice) can act on. */
export type Finding = { tone: "bad" | "warn" | "good"; text: string; fix?: string; details?: FindingDetail[] };

/** Same page whatever the host spelling, scheme or final "/". */
const pageKey = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

/** The pages that link to each address, from every crawled page's own links. */
function linkIndex(pages: CrawlPage[]): (url: string) => string[] {
  const from = new Map<string, Set<string>>();
  for (const page of pages)
    for (const link of page.links ?? []) {
      const key = pageKey(link);
      if (key === pageKey(page.finalUrl)) continue;
      if (!from.has(key)) from.set(key, new Set());
      from.get(key)!.add(page.finalUrl);
    }
  return (url) => [...(from.get(pageKey(url)) ?? [])].sort();
}

const AREA: Record<LinkAnchor["area"], string> = { menu: "in the menu", footer: "in the footer", body: "in the page text" };

/** "gbj.com/vote" written without https:// opens as a page on the practice's own site. */
const missingScheme = (href: string) => !/^(https?:|\/|#|\.|mailto:|tel:)/i.test(href) && /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(href);

/** 'the "Vote here" link in the page text' */
export function describeAnchor(a: LinkAnchor): string {
  return `${a.text ? `the "${a.text}" link` : "a link with no words (an image or icon)"} ${AREA[a.area]}`;
}

/** Why the link breaks, when it's how it was written. */
const hrefFault = (a: LinkAnchor) =>
  missingScheme(a.href) ? ` It's written as "${a.href}", without https://, so browsers open it as a page on your own site.` : "";

const HELLO_WORLD = /hello-world/i;

const hops = (chain: RedirectHop[]) => chain.map((hop) => `${hop.url} (${hop.status})`);

/** The same pages the crawl summary counts: loaded fine, once per final address. */
function okPages(pages: CrawlPage[]): CrawlPage[] {
  const seen = new Map<string, CrawlPage>();
  for (const page of pages) if (page.finalStatus === 200 && !page.softError && !seen.has(page.finalUrl)) seen.set(page.finalUrl, page);
  return [...seen.values()];
}

/** Plain-English technical findings (they print in the client report), each traceable to the URLs behind it. */
const pages = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const TONE_ORDER = { bad: 0, warn: 1, good: 2 } as const;

/** A link list longer than this shows the first few (listing pages first) and a count. */
const LINKED_SHOWN = 3;

export function technicalFindings(t: TechnicalCrawl): Finding[] {
  const s = t.summary;
  const ok = okPages(t.pages);
  const linkIndexOf = linkIndex(t.pages);
  const byFinal = new Map(t.pages.map((p) => [p.finalUrl, p]));
  /** How one page links to an address (crawls since 2026-11-09 keep this for bad links). */
  const anchorsTo = (page: string, url: string) => (byFinal.get(page)?.anchors ?? []).filter((a) => pageKey(a.url) === pageKey(url));
  // A link on (nearly) every page is in the menu or footer: say so instead of listing them all.
  const siteWide = (from: string[]) => ok.length >= 5 && from.length >= Math.ceil(ok.length * 0.8);
  const linkedFrom = (url: string) => linkIndexOf(url);
  const linkedNote = (url: string, from: string[]) => {
    if (!siteWide(from)) return "";
    const a = from.flatMap((page) => anchorsTo(page, url))[0];
    return ` · Linked from ${from.length} pages${a ? `: ${describeAnchor(a)}` : ", so it's in the menu or footer"}`;
  };
  /** Each linking page, with the link's words and place when the crawl kept them. */
  const linkedList = (url: string, from: string[]) =>
    siteWide(from)
      ? undefined
      : (() => {
          // A blog's "recent posts" box links every post from every other one; a few are enough to find it.
          // Real pages first (the blog page itself), leftovers and automatic listings last.
          const junk = (u: string) => (HELLO_WORLD.test(u) || isListingPage(u) || byFinal.get(u)?.archiveType ? 1 : 0);
          const shown = from.length > LINKED_SHOWN + 1 ? [...from].sort((a, b) => junk(a) - junk(b) || a.length - b.length).slice(0, LINKED_SHOWN) : from;
          const list = shown.map((page) => {
            const a = anchorsTo(page, url);
            return a.length ? `${page} (${a.map(describeAnchor).join("; ")})` : page;
          });
          return shown.length < from.length ? [...list, `and ${from.length - shown.length} more pages`] : list;
        })();
  const byUrl = new Map(t.pages.map((p) => [p.url, p]));
  /** A sitemap address that fails: its status, the sitemap listing it, and who links to it. */
  const failing = (url: string, note: string): FindingDetail => ({
    url,
    note: `${note}. Listed in your sitemap${byUrl.get(url)?.sitemap ? ` (${byUrl.get(url)!.sitemap})` : ""}${linkedNote(url, linkedFrom(url))}`,
    linkedFrom: linkedList(url, linkedFrom(url)),
  });
  /** A page's other spelling (with or without the final "/") and where it went. */
  const variant = (v: TechnicalCrawl["slashVariants"][number]): FindingDetail => ({ url: v.variantUrl, note: `The other spelling of ${v.pageUrl}`, items: hops(v.chain) });
  /**
   * Addresses typed without (or with) the final "/" that all bounce through http
   * are one server setting, not one fix each: a single entry with an example.
   */
  const insecureVariants = (variants: TechnicalCrawl["slashVariants"]): FindingDetail[] => {
    if (variants.length < 3) return variants.map(variant);
    const groups = new Map<boolean, TechnicalCrawl["slashVariants"]>();
    for (const v of variants) {
      const noSlash = !new URL(v.variantUrl).pathname.endsWith("/");
      groups.set(noSlash, [...(groups.get(noSlash) ?? []), v]);
    }
    return [...groups.entries()].map(([noSlash, vs]) =>
      vs.length === 1
        ? variant(vs[0])
        : {
            label: `${vs.length} addresses typed ${noSlash ? "without" : "with"} the final "/"`,
            note: `Each one goes to the http version before landing on the right page, for example ${vs[0].chain.map((h) => h.url).join(" → ")}. They all come from one server setting, so one fix covers every one of them.`,
            items: vs.map((v) => v.variantUrl),
          },
    );
  };
  const hosts = Object.entries(s.byHost).map(([host, n]) => `${n} on ${host}`).join(", ");
  const list: Finding[] = [];
  list.push({
    tone: Object.keys(s.byHost).length > 1 ? "warn" : "good",
    text: `Your sitemap (the list of pages you give Google) has ${s.totalUrls} addresses (${hosts}), which add up to ${s.uniquePages} different pages.`,
    fix: Object.keys(s.byHost).length > 1 ? "List each page once, at its one true address (https, with or without www, as the site uses)." : undefined,
  });
  const filler = s.tagPages + s.categoryPages + s.authorPages;
  if (filler > 0)
    list.push({
      tone: "warn",
      text: `${plural(filler, "filler page", "filler pages")} (automatic tag, category or author listings) ${filler === 1 ? "is" : "are"} in your sitemap. ${filler === 1 ? "It adds" : "They add"} clutter without adding anything a visitor needs.`,
      fix: "Leave tag, category and author listings out of the sitemap (on WordPress, a setting in the SEO plugin).",
      details: t.pages.filter((p) => p.archiveType).map((p) => ({ url: p.url, note: `Automatic ${p.archiveType} listing` })),
    });
  if (s.serverErrors.length) list.push({ tone: "bad", text: `${plural(s.serverErrors.length, "page fails", "pages fail")} to load because of a server error.`, fix: "Ask the web host or developer to check the server's error log for these pages.", details: s.serverErrors.map((u) => failing(u, `Server error (${byUrl.get(u)?.finalStatus ?? "5xx"})`)) });
  if (s.softErrors?.length)
    list.push({ tone: "bad", text: `${plural(s.softErrors.length, "page shows", "pages show")} an error message instead of the page. Your server reports them as working, so many tools miss this.`, fix: "Open each page to see the error, then fix the page or remove it from the sitemap.", details: s.softErrors.map((u) => failing(u, byUrl.get(u)?.softError === "redirect-loop" ? "Shows a redirect-loop error" : "Shows a server error message")) });
  if (s.notFound.length) list.push({ tone: "bad", text: `${plural(s.notFound.length, "page is", "pages are")} missing ("page not found").`, fix: "Redirect each one to the closest live page, take it out of the sitemap, and update the links that point to it.", details: s.notFound.map((u) => failing(u, "Page not found (404)")) });
  if (s.redirectLoops.length) list.push({ tone: "bad", text: `${plural(s.redirectLoops.length, "page sends", "pages send")} visitors round in circles and never load.`, fix: "Fix the redirect rules so each address ends on one working page (the steps show where it goes round).", details: s.redirectLoops.map((u) => ({ ...failing(u, "Redirects in a loop"), items: hops(byUrl.get(u)?.chain ?? []) })) });
  if (s.slashVariants.loops.length)
    list.push({ tone: "bad", text: `${plural(s.slashVariants.loops.length, "page breaks", "pages break")} if the address is typed with or without the final "/". Visitors see an error instead of the page.`, fix: "Set the server to redirect the other spelling straight to the working page.", details: t.slashVariants.filter((v) => s.slashVariants.loops.includes(v.variantUrl)).map(variant) });
  if (s.insecureRedirects.length || s.slashVariants.insecure.length)
    list.push({
      tone: "bad",
      text: "Some old links send visitors to the insecure (http) version of your site before the secure one. Browsers can warn visitors, and Google prefers sites that are secure throughout.",
      details: [
        ...s.insecureRedirects.map((u) => ({ url: u, note: `Passes through http on the way${linkedNote(u, linkedFrom(u))}`, items: hops(byUrl.get(u)?.chain ?? []), linkedFrom: linkedList(u, linkedFrom(u)) })),
        ...insecureVariants(t.slashVariants.filter((v) => s.slashVariants.insecure.includes(v.variantUrl))),
      ],
      fix: "Change each old link to point straight at the https address, and set the server's redirects to go straight to https rather than via http.",
    });
  if (s.slashVariants.broken?.length)
    list.push({ tone: "bad", text: `${plural(s.slashVariants.broken.length, "page shows", "pages show")} an error if the address is typed with or without the final "/".`, fix: "Set the server to redirect the other spelling straight to the working page.", details: t.slashVariants.filter((v) => s.slashVariants.broken.includes(v.variantUrl)).map(variant) });
  if (s.slashVariants.duplicates.length)
    list.push({
      tone: "warn",
      text: `${s.slashVariants.duplicates.length} of ${s.slashVariants.checked} pages also load at a second address (with or without the final "/"), so Google sees two copies of the same page.`,
      fix: "One server setting: redirect the second address to the main one. A canonical tag on each page also tells Google which to use.",
      details: t.slashVariants.filter((v) => s.slashVariants.duplicates.includes(v.variantUrl)).map((v) => ({ url: v.variantUrl, note: `Also loads, with no redirect, as ${v.pageUrl}` })),
    });
  list.push(
    s.missingCanonical
      ? {
          tone: "warn",
          text: `${s.missingCanonical} of ${s.uniquePages} pages don't tell Google which address is their main one (a "canonical tag"), so Google has to guess between copies.`,
          fix: "Add a canonical tag to each of these pages giving its own address (most SEO plugins and site builders have a setting for it).",
          details: s.missingCanonicalUrls.map((u) => ({ url: u })),
        }
      : { tone: "good", text: "Every page tells Google which address is its main one." },
  );
  list.push(
    s.withSchema
      ? {
          tone: s.withSchema === s.uniquePages ? "good" : "warn",
          text:
            s.withSchema === s.uniquePages
              ? `All ${s.uniquePages} pages carry behind-the-scenes labels that tell Google and AI tools what the page is about (structured data).`
              : `${s.uniquePages - s.withSchema} of ${s.uniquePages} pages have none of the behind-the-scenes labels that tell Google and AI tools what the page is about (structured data).`,
          fix: s.withSchema === s.uniquePages ? undefined : "Add structured data to these pages: at least the practice's details (veterinary care) site-wide, and a service label on each service page.",
          details: ok.filter((p) => !p.schemaTypes.length).map((p) => ({ url: p.finalUrl, note: "No structured data" })),
        }
      : { tone: "bad", text: "No page carries the behind-the-scenes labels (structured data) that tell Google and AI tools what the page is about.", fix: "Add structured data site-wide: at least the practice's details (veterinary care), and a service label on each service page." },
  );
  if (s.repeatedH1OnPage.length) list.push({ tone: "warn", text: "The main headline appears twice on the same page.", fix: "Keep one copy as the main headline (H1) and make the other a smaller heading or plain text.", details: ok.filter((p) => new Set(p.h1s).size < p.h1s.length).map((p) => ({ url: p.finalUrl, items: p.h1s })) });
  if (s.noH1)
    list.push({
      tone: "warn",
      text: `${pages(s.noH1)} ${s.noH1 === 1 ? "has" : "have"} no main headline.`,
      fix: "Give each page one main headline (H1) saying what the page is about.",
      details: ok.filter((p) => !p.h1s.length).map((p) => ({ url: p.finalUrl, note: p.title ? `Page title: "${p.title}"` : undefined })),
    });
  if (s.multipleH1)
    list.push({
      tone: "warn",
      text: `${pages(s.multipleH1)} ${s.multipleH1 === 1 ? "has" : "have"} more than one main headline.`,
      fix: "Keep one main headline (H1) per page and make the rest smaller headings (H2). Where a headline is split over two lines, make it one H1.",
      details: ok.filter((p) => p.h1s.length > 1).map((p) => ({ url: p.finalUrl, note: `${p.h1s.length} main headlines (H1)`, items: p.h1s })),
    });
  if (s.duplicateH1AcrossPages.length)
    list.push({
      tone: "warn",
      text: `${plural(s.duplicateH1AcrossPages.length, "main headline is", "main headlines are")} used on more than one page, so the pages look alike to Google.`,
      fix: "Give each page a headline of its own that says what's different about it.",
      details: s.duplicateH1AcrossPages.map((d) => ({
        label: `"${d.h1}"`,
        note: `Main headline on ${d.pages} pages`,
        items: ok.filter((p) => p.h1s.includes(d.h1)).map((p) => p.finalUrl),
      })),
    });
  if (s.missingMetaDescription)
    list.push({
      tone: "warn",
      text: `${pages(s.missingMetaDescription)} ${s.missingMetaDescription === 1 ? "has" : "have"} no summary for Google to show under the link in search results (meta description).`,
      fix: "Write a one or two sentence summary for each page (the meta description, in the page's SEO settings).",
      details: ok.filter((p) => !p.metaDescription).map((p) => ({ url: p.finalUrl, note: p.title ? `Page title: "${p.title}"` : undefined })),
    });
  if (s.thinPages)
    list.push({
      tone: "warn",
      text: `${pages(s.thinPages)} ${s.thinPages === 1 ? "has" : "have"} under 300 words, which is usually too little for Google or AI to treat ${s.thinPages === 1 ? "it" : "them"} as a good answer.`,
      fix: "Add useful detail to the pages people search for (services, about, the team). Forms and similar pages can be left as they are.",
      details: ok
        .filter((p) => p.wordCount < 300 && !p.archiveType)
        .sort((a, b) => a.wordCount - b.wordCount)
        .map((p) => ({ url: p.finalUrl, note: `${p.wordCount} words` })),
    });
  // Listing pages (tags, months) are left out on purpose; audits before 2026-10-28 still have them.
  const live = (t.notInSitemap ?? []).filter((g) => g.finalStatus === 200 && !g.softError && !isListingPage(g.url));
  const helloWorld = live.filter((g) => HELLO_WORLD.test(g.url));
  const gaps = live.filter((g) => !HELLO_WORLD.test(g.url));
  const allPosts = gaps.length > 1 && gaps.every((g) => /\/(blog|news|posts?|articles?)\//i.test(g.url));
  if (gaps.length)
    list.push({
      tone: "warn",
      text: `${plural(gaps.length, "page your site links to is", "pages your site links to are")} missing from your sitemap, so Google is slower to find ${gaps.length === 1 ? "it" : "them"}.`,
      fix: allPosts
        ? "They're all blog posts, so the sitemap probably isn't adding new posts by itself. Check the sitemap setting in the SEO plugin or site builder, rather than adding them one by one."
        : "Add them to the sitemap (most SEO plugins and site builders do this automatically once the page is set to be indexed).",
      details: gaps.map((g) => {
        const from = linkedFrom(g.url).length ? linkedFrom(g.url) : g.linkedFrom;
        return { url: g.url, note: `Not in your sitemap${linkedNote(g.url, from)}`, linkedFrom: linkedList(g.url, from) };
      }),
    });
  const brokenLinks = (t.notInSitemap ?? []).filter((g) => g.finalStatus !== 200 || g.softError);
  if (brokenLinks.length)
    list.push({
      tone: "bad",
      text: `${plural(brokenLinks.length, "link on your site leads to a page that doesn't", "links on your site lead to pages that don't")} load.`,
      fix: "Change each link to the right page, or remove it. The page to edit is the one listed first.",
      // Led by the page the bad link sits on, since that's where it gets fixed; a page with several gets one entry.
      details: (() => {
        const byPage = new Map<string, string[]>();
        for (const g of brokenLinks) {
          const status = g.softError ? "shows an error page" : g.finalStatus === 404 ? "is \"page not found\" (404)" : g.finalStatus ? `fails (${g.finalStatus})` : "doesn't answer";
          const on = linkedFrom(g.url).length ? linkedFrom(g.url) : g.linkedFrom;
          if (siteWide(on)) {
            const a = on.flatMap((page) => anchorsTo(page, g.url))[0];
            const label = `On ${on.length} pages (${a ? a.area === "footer" ? "the footer" : "the menu" : "the menu or footer"})`;
            const what = a ? describeAnchor(a) : "a link";
            byPage.set(label, [...(byPage.get(label) ?? []), `${what.charAt(0).toUpperCase()}${what.slice(1)} goes to ${g.url}, which ${status}.${a ? hrefFault(a) : ""}`]);
            continue;
          }
          for (const page of on) {
            const how = anchorsTo(page, g.url);
            const what = how.length ? how.map(describeAnchor).join("; ") : "a link";
            byPage.set(page, [...(byPage.get(page) ?? []), `${what.charAt(0).toUpperCase()}${what.slice(1)} goes to ${g.url}, which ${status}.${how.map(hrefFault).join("")}`]);
          }
        }
        return [...byPage.entries()].map(([page, bad]): FindingDetail => {
          const at = page.startsWith("http") ? { url: page } : { label: page };
          return bad.length === 1 ? { ...at, note: bad[0] } : { ...at, note: `${bad.length} links that don't work:`, items: bad };
        });
      })(),
    });
  if (s.helloWorldInSitemap || helloWorld.length)
    list.push({
      tone: "warn",
      text: `The "Hello world!" sample post that comes with WordPress is still on the site${s.helloWorldInSitemap ? " and in your sitemap" : ""}.`,
      fix: "Delete the sample post.",
      details: [
        ...t.pages.filter((p) => HELLO_WORLD.test(p.url)).map((p) => ({ url: p.url })),
        ...helloWorld.map((g) => ({ url: g.url, linkedFrom: linkedList(g.url, linkedFrom(g.url).length ? linkedFrom(g.url) : g.linkedFrom) })),
      ],
    });
  const robots = Object.values(t.robotsTxt).some(Boolean);
  const llms = Object.values(t.llmsTxt).some(Boolean);
  list.push({ tone: robots ? "good" : "warn", text: robots ? "Your site has a robots.txt file (instructions for search engines)." : "Your site has no robots.txt file (instructions for search engines).", fix: robots ? undefined : "Add a robots.txt file at the top of the site that points search engines to the sitemap." });
  list.push({ tone: llms ? "good" : "warn", text: llms ? "Your site has an llms.txt file (a short guide for AI tools)." : "Your site has no llms.txt file, a short guide that helps AI tools understand it.", fix: llms ? undefined : "Add an llms.txt file at the top of the site: a few lines on who the practice is, where it is, and links to its main pages." });
  if (s.noViewport)
    list.push({
      tone: "warn",
      text: `${pages(s.noViewport)} ${s.noViewport === 1 ? "isn't" : "aren't"} set up to display properly on phones.`,
      fix: "Add the mobile viewport setting to these pages (usually one line in the site's page template).",
      details: ok.filter((p) => !p.hasViewport).map((p) => ({ url: p.finalUrl, note: "No mobile viewport setting" })),
    });
  if (t.stoppedBecause !== "done") list.push({ tone: "warn", text: `The crawl stopped early (${t.stoppedBecause === "time" ? "time limit" : "500-URL limit"}); results are partial.` });
  // Worst first; within a colour, the order above.
  return list.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
