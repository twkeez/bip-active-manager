import { isListingPage } from "@/lib/website-audit/archive";
import type { CrawlPage, LinkAnchor, RedirectHop, TechnicalCrawl } from "@/lib/website-audit/types";

// Shared by the audit screen and the printed report (no server imports here).

/**
 * One place an issue shows up, so it can be found and fixed: the page (or, for
 * a headline used on several pages, the headline) and its title, what's wrong there, the
 * specifics (the headlines, the redirect steps) and the pages linking to it.
 */
export type FindingDetail = { url?: string; title?: string; label?: string; note?: string; items?: string[]; linkedFrom?: string[] };

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

/** The same address only when the final "/" matches too: /about and /about/ are different here. */
const exactKey = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.host.replace(/^www\./, "")}${u.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

/** The pages that link to each address, from every crawled page's own links. */
function linkIndex(pages: CrawlPage[], keyOf: (url: string) => string = pageKey): (url: string) => string[] {
  const from = new Map<string, Set<string>>();
  for (const page of pages)
    for (const link of page.links ?? []) {
      const key = keyOf(link);
      if (key === pageKey(page.finalUrl)) continue;
      if (!from.has(key)) from.set(key, new Set());
      from.get(key)!.add(page.finalUrl);
    }
  return (url) => [...(from.get(keyOf(url)) ?? [])].sort();
}

const AREA: Record<LinkAnchor["area"], string> = { menu: "in the menu", footer: "in the footer", body: "in the page text" };

/** "gbj.com/vote" written without https:// opens as a page on the practice's own site. */
const missingScheme = (href: string) => !/^(https?:|\/|#|\.|mailto:|tel:)/i.test(href) && /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(href);

/** 'the "Vote here" link in the page text', and with `withContext` the words around it to search for. */
export function describeAnchor(a: LinkAnchor, withContext = false): string {
  const what = `${a.text ? `the "${a.text}" link` : "a link with no words (an image or icon)"} ${AREA[a.area]}`;
  return withContext && a.context ? `${what}, in: "${a.context}"` : what;
}

/** "Why Early Care Matters - Dallas Highway Animal Hospital" → "Why Early Care Matters". */
export function shortTitle(title: string | null | undefined): string | undefined {
  const t = (title ?? "").trim();
  if (!t) return undefined;
  const cut = t.replace(/\s+[|–—-]\s+[^|–—-]+$/, "").trim();
  return cut.length >= 4 ? cut : t;
}

const STOP = new Set(["a", "an", "and", "amp", "the", "of", "in", "for", "to", "your", "you", "is", "on", "with", "how", "why", "what", "html", "htm", "php"]);
/** The words of an address's last part, without ids or filler: "/blogs/1105177-kittens-101" → kittens, 101. */
const slugWords = (url: string) => {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
    return last.toLowerCase().replace(/\.(html?|php)$/, "").split(/[-_]+/).filter((w) => w && !STOP.has(w) && !/^\d{4,}$/.test(w));
  } catch {
    return [];
  }
};

/** A live page whose address says the same thing as a dead one (an old blog's post at its new address), or null. */
export function likelyReplacement(dead: string, live: string[]): string | null {
  const want = slugWords(dead);
  if (want.length < 2) return null;
  let best: { url: string; score: number } | null = null;
  for (const url of live) {
    const have = new Set(slugWords(url));
    if (!have.size) continue;
    const shared = want.filter((w) => have.has(w)).length;
    // Most of the dead address's words, and not a much longer, different topic.
    const score = shared / Math.max(want.length, have.size * 0.75);
    if (shared >= 2 && score >= 0.7 && (!best || score > best.score)) best = { url, score };
  }
  return best?.url ?? null;
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

/** What the crawl never looks at, whatever the site: said in the report so nobody assumes it found everything. */
export function notChecked(t: TechnicalCrawl): string[] {
  return [
    ...(t.external
      ? t.external.unverified
        ? [`${plural(t.external.unverified, "link to another website", "links to other websites")} couldn't be confirmed either way: the other site refused or didn't answer our crawler (Facebook and similar sites always do). We report a link to another website only when its page is certainly gone.`]
        : []
      : ["Links to other websites (a pet insurance company or the AVMA, say) weren't checked on this run; run the technical crawl again to check them."]),
    ...NOT_CHECKED,
  ];
}

const NOT_CHECKED = [
  "Links on pages that aren't in your sitemap aren't read; we only check that those pages load.",
  "Links to PDFs, images and other files aren't checked.",
  "Links with a \"?\" in the address (searches, page 2 of a list) are skipped, as are links that only appear once a page's scripts run (some pop-up menus).",
];

/**
 * Where this crawl was cut short. Crawls from 2026-11-11 record every cap they
 * hit; older ones only know whether the page crawl itself stopped early.
 */
export function crawlLimits(t: TechnicalCrawl): { hit: string[]; recorded: boolean } {
  if (t.limitsHit) return { hit: t.limitsHit, recorded: true };
  const hit: string[] = [];
  if (t.sitemapUrlCount > 500) hit.push(`Your sitemap lists ${t.sitemapUrlCount} addresses; we checked the first 500.`);
  else if (t.stoppedBecause === "time") hit.push(`We ran out of time and checked ${t.pages.length} of the sitemap addresses.`);
  return { hit, recorded: false };
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
  // For "with or without the final /" checks: who links to exactly that spelling.
  const spelledFrom = linkIndex(t.pages, exactKey);
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
            return a.length ? `${page} (${a.map((x) => describeAnchor(x, true)).join("; ")})` : page;
          });
          return shown.length < from.length ? [...list, `and ${from.length - shown.length} more pages`] : list;
        })();
  /** A plain list of linking pages, shortened like linkedList. */
  const shortList = (from: string[]) => (from.length > LINKED_SHOWN + 1 ? [...from.slice(0, LINKED_SHOWN), `and ${from.length - LINKED_SHOWN} more pages`] : from);
  const byUrl = new Map(t.pages.map((p) => [p.url, p]));
  const titleOf = (url: string) => shortTitle(byFinal.get(url)?.title ?? byUrl.get(url)?.title);
  /** A page's address with its title, when the crawl read it. */
  const at = (url: string): FindingDetail => {
    const title = titleOf(url);
    return title ? { url, title } : { url };
  };
  /** Addresses that load today, for suggesting where a dead link should point. */
  const liveUrls = [...ok.map((p) => p.finalUrl), ...(t.notInSitemap ?? []).filter((g) => g.finalStatus === 200 && !g.softError).map((g) => g.url)];
  /** A sitemap address that fails: its status, the sitemap listing it, and who links to it. */
  const failing = (url: string, note: string): FindingDetail => ({
    ...at(url),
    note: `${note}. Listed in your sitemap${byUrl.get(url)?.sitemap ? ` (${byUrl.get(url)!.sitemap})` : ""}${linkedNote(url, linkedFrom(url))}`,
    linkedFrom: linkedList(url, linkedFrom(url)),
  });
  /** A page's other spelling (with or without the final "/") and where it went. */
  const TESTED = "Nothing on your site links to it: we typed it ourselves to test your server";
  const variant = (v: TechnicalCrawl["slashVariants"][number]): FindingDetail => {
    const from = spelledFrom(v.variantUrl);
    return from.length
      ? { url: v.variantUrl, note: `The other spelling of ${v.pageUrl}${siteWide(from) ? ` · Linked from ${from.length} pages, so it's in the menu or footer` : ""}`, items: hops(v.chain), linkedFrom: siteWide(from) ? undefined : shortList(from) }
      : { url: v.variantUrl, note: `The other spelling of ${v.pageUrl}. ${TESTED}.`, items: hops(v.chain) };
  };
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
            note: `Each one goes to the http version before landing on the right page, for example ${vs[0].chain.map((h) => h.url).join(" → ")}. ${
              vs.some((v) => spelledFrom(v.variantUrl).length)
                ? "Most aren't linked from your pages: we typed them to test your server. Where a page does link to one, it's named below."
                : "These aren't links on your site, so there's nothing to find on a page: we typed each address ourselves to test your server."
            } They all come from one server setting, so one fix covers every one of them.`,
            items: vs.map((v) => {
              const from = spelledFrom(v.variantUrl);
              if (!from.length) return v.variantUrl;
              return `${v.variantUrl} (linked this way from ${from.length === 1 ? from[0] : `${from.length} pages, e.g. ${from[0]}`}: change that link to ${v.pageUrl})`;
            }),
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
      details: t.pages.filter((p) => p.archiveType).map((p) => ({ ...at(p.url), note: `Automatic ${p.archiveType} listing` })),
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
        ...s.insecureRedirects.map((u) => ({
          url: u,
          note: `Passes through http on the way. Listed in your sitemap${byUrl.get(u)?.sitemap ? ` (${byUrl.get(u)!.sitemap})` : ""}, so take it out or replace it with the final address${linkedNote(u, linkedFrom(u))}`,
          items: hops(byUrl.get(u)?.chain ?? []),
          linkedFrom: linkedList(u, linkedFrom(u)),
        })),
        ...insecureVariants(t.slashVariants.filter((v) => s.slashVariants.insecure.includes(v.variantUrl))),
      ],
      fix: "Change each old link to point straight at the https address, and set the server's redirects to go straight to https rather than via http.",
    });
  if (s.slashVariants.broken?.length)
    list.push({ tone: "bad", text: `${plural(s.slashVariants.broken.length, "page shows", "pages show")} an error if the address is typed with or without the final "/".`, fix: "Set the server to redirect the other spelling straight to the working page.", details: t.slashVariants.filter((v) => s.slashVariants.broken.includes(v.variantUrl)).map(variant) });
  if (s.slashVariants.duplicates.length)
    list.push({
      tone: "warn",
      text: `${s.slashVariants.duplicates.length} of ${s.slashVariants.checked} pages also load at a second address (with or without the final "/"), so Google sees two copies of the same page.${
        s.slashVariants.duplicates.some((u) => spelledFrom(u).length) ? "" : " We found these by typing each address ourselves; your pages don't link to the second versions."
      }`,
      fix: "One server setting: redirect the second address to the main one. A canonical tag on each page also tells Google which to use.",
      details: t.slashVariants.filter((v) => s.slashVariants.duplicates.includes(v.variantUrl)).map((v) => ({
        url: v.variantUrl,
        note: `Also loads, with no redirect, as ${v.pageUrl}`,
        linkedFrom: spelledFrom(v.variantUrl).length ? shortList(spelledFrom(v.variantUrl)) : undefined,
      })),
    });
  list.push(
    s.missingCanonical
      ? {
          tone: "warn",
          text: `${s.missingCanonical} of ${s.uniquePages} pages don't tell Google which address is their main one (a "canonical tag"), so Google has to guess between copies.`,
          fix: "Add a canonical tag to each of these pages giving its own address (most SEO plugins and site builders have a setting for it).",
          details: s.missingCanonicalUrls.map(at),
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
          details: ok.filter((p) => !p.schemaTypes.length).map((p) => at(p.finalUrl)),
        }
      : { tone: "bad", text: "No page carries the behind-the-scenes labels (structured data) that tell Google and AI tools what the page is about.", fix: "Add structured data site-wide: at least the practice's details (veterinary care), and a service label on each service page." },
  );
  if (s.repeatedH1OnPage.length) list.push({ tone: "warn", text: "The main headline appears twice on the same page.", fix: "Keep one copy as the main headline (H1) and make the other a smaller heading or plain text.", details: ok.filter((p) => new Set(p.h1s).size < p.h1s.length).map((p) => ({ ...at(p.finalUrl), items: p.h1s })) });
  if (s.noH1)
    list.push({
      tone: "warn",
      text: `${pages(s.noH1)} ${s.noH1 === 1 ? "has" : "have"} no main headline.`,
      fix: "Give each page one main headline (H1) saying what the page is about.",
      details: ok.filter((p) => !p.h1s.length).map((p) => at(p.finalUrl)),
    });
  if (s.multipleH1)
    list.push({
      tone: "warn",
      text: `${pages(s.multipleH1)} ${s.multipleH1 === 1 ? "has" : "have"} more than one main headline.`,
      fix: "Keep one main headline (H1) per page and make the rest smaller headings (H2). Where a headline is split over two lines, make it one H1.",
      details: ok.filter((p) => p.h1s.length > 1).map((p) => ({ ...at(p.finalUrl), note: `${p.h1s.length} main headlines (H1)`, items: p.h1s })),
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
      details: ok.filter((p) => !p.metaDescription).map((p) => at(p.finalUrl)),
    });
  if (s.thinPages)
    list.push({
      tone: "warn",
      text: `${pages(s.thinPages)} ${s.thinPages === 1 ? "has" : "have"} under 300 words, which is usually too little for Google or AI to treat ${s.thinPages === 1 ? "it" : "them"} as a good answer.`,
      fix: "Add useful detail to the pages people search for (services, about, the team). Forms and similar pages can be left as they are.",
      details: ok
        .filter((p) => p.wordCount < 300 && !p.archiveType)
        .sort((a, b) => a.wordCount - b.wordCount)
        .map((p) => ({ ...at(p.finalUrl), note: `${p.wordCount} words` })),
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
            const instead = likelyReplacement(g.url, liveUrls);
            byPage.set(label, [...(byPage.get(label) ?? []), `${what.charAt(0).toUpperCase()}${what.slice(1)} goes to ${g.url}, which ${status}.${a ? hrefFault(a) : ""}${instead ? ` It probably should go to ${instead}.` : ""}`]);
            continue;
          }
          const instead = likelyReplacement(g.url, liveUrls);
          const suggestion = instead ? ` It probably should go to ${instead}.` : "";
          for (const page of on) {
            const how = anchorsTo(page, g.url);
            const what = how.length ? how.map((a) => describeAnchor(a)).join("; ") : "a link";
            const look = how.map((a) => a.context).filter(Boolean);
            byPage.set(page, [
              ...(byPage.get(page) ?? []),
              `${what.charAt(0).toUpperCase()}${what.slice(1)} goes to ${g.url}, which ${status}.${how.map(hrefFault).join("")}${look.length ? ` Search the page for: "${look[0]}"` : ""}${suggestion}`,
            ]);
          }
        }
        return [...byPage.entries()].map(([page, bad]): FindingDetail => {
          const where = page.startsWith("http") ? at(page) : { label: page };
          return bad.length === 1 ? { ...where, note: bad[0] } : { ...where, note: `${bad.length} links that don't work:`, items: bad };
        });
      })(),
    });
  const deadExternal = t.external?.dead ?? [];
  if (deadExternal.length)
    list.push({
      tone: "bad",
      text: `${plural(deadExternal.length, "link to another website is", "links to other websites are")} dead: the page is gone, or the whole website no longer exists.`,
      fix: "Change each link to a page that works, or remove it. The page to edit is the one listed first.",
      // Same shape as the links between your own pages: led by the page the link sits on.
      details: (() => {
        const WHY = { "not-found": "is \"page not found\" (404)", gone: "has been removed (410)", "no-site": "is a website that no longer exists" } as const;
        const byPage = new Map<string, string[]>();
        for (const d of deadExternal) {
          const first = d.from[0];
          const what = first ? describeAnchor({ url: d.url, href: d.url, text: first.text, area: first.area }) : "a link";
          const line = (context?: string) => `${what.charAt(0).toUpperCase()}${what.slice(1)} goes to ${d.url}, which ${WHY[d.why]}.${context ? ` Search the page for: "${context}"` : ""}`;
          if (ok.length >= 5 && d.pages >= Math.ceil(ok.length * 0.8)) {
            const label = `On ${d.pages} pages (${first?.area === "footer" ? "the footer" : first?.area === "menu" ? "the menu" : "the menu or footer"})`;
            byPage.set(label, [...(byPage.get(label) ?? []), line()]);
            continue;
          }
          for (const f of d.from) {
            const here = describeAnchor({ url: d.url, href: d.url, text: f.text, area: f.area });
            byPage.set(f.page, [...(byPage.get(f.page) ?? []), `${here.charAt(0).toUpperCase()}${here.slice(1)} goes to ${d.url}, which ${WHY[d.why]}.${f.context ? ` Search the page for: "${f.context}"` : ""}${d.pages > d.from.length ? ` (It's on ${d.pages} pages in all.)` : ""}`]);
          }
        }
        return [...byPage.entries()].map(([page, bad]): FindingDetail => {
          const where = page.startsWith("http") ? at(page) : { label: page };
          return bad.length === 1 ? { ...where, note: bad[0] } : { ...where, note: `${bad.length} dead links:`, items: bad };
        });
      })(),
    });
  else if (t.external && t.external.checked > t.external.unverified)
    list.push({ tone: "good", text: `None of the ${t.external.checked - t.external.unverified} links to other websites we could check is dead.` });
  if (s.helloWorldInSitemap || helloWorld.length)
    list.push({
      tone: "warn",
      text: `The "Hello world!" sample post that comes with WordPress is still on the site${s.helloWorldInSitemap ? " and in your sitemap" : ""}.`,
      fix: "Delete the sample post.",
      details: [
        ...t.pages.filter((p) => HELLO_WORLD.test(p.url)).map((p) => at(p.url)),
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
      details: ok.filter((p) => !p.hasViewport).map((p) => at(p.finalUrl)),
    });
  // Worst first; within a colour, the order above.
  return list.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
