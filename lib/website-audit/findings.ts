import { isListingPage } from "@/lib/website-audit/archive";
import type { TechnicalCrawl } from "@/lib/website-audit/types";

// Shared by the audit screen and the printed report (no server imports here).

export type Finding = { tone: "bad" | "warn" | "good"; text: string; urls?: string[] };

/** Plain-English technical findings (they print in the client report), each traceable to the URLs behind it. */
const pages = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;

export function technicalFindings(t: TechnicalCrawl): Finding[] {
  const s = t.summary;
  const hosts = Object.entries(s.byHost).map(([host, n]) => `${n} on ${host}`).join(", ");
  const list: Finding[] = [];
  list.push({
    tone: Object.keys(s.byHost).length > 1 ? "warn" : "good",
    text: `Your sitemap (the list of pages you give Google) has ${s.totalUrls} addresses (${hosts}), which add up to ${s.uniquePages} different pages.`,
  });
  if (s.tagPages + s.categoryPages + s.authorPages > 0)
    list.push({ tone: "warn", text: `${s.tagPages + s.categoryPages + s.authorPages} filler ${s.tagPages + s.categoryPages + s.authorPages === 1 ? "page" : "pages"} (automatic tag, category or author listings) are in your sitemap. They add clutter without adding anything a visitor needs.` });
  if (s.serverErrors.length) list.push({ tone: "bad", text: `${s.serverErrors.length} pages fail to load because of a server error.`, urls: s.serverErrors });
  if (s.softErrors?.length)
    list.push({ tone: "bad", text: `${s.softErrors.length} pages show an error message instead of the page. Your server reports them as working, so many tools miss this.`, urls: s.softErrors });
  if (s.notFound.length) list.push({ tone: "bad", text: `${s.notFound.length} pages are missing ("page not found").`, urls: s.notFound });
  if (s.redirectLoops.length) list.push({ tone: "bad", text: `${s.redirectLoops.length} pages send visitors round in circles and never load.`, urls: s.redirectLoops });
  if (s.slashVariants.loops.length)
    list.push({ tone: "bad", text: `${s.slashVariants.loops.length} pages break if the address is typed with or without the final "/". Visitors see an error instead of the page.`, urls: s.slashVariants.loops });
  if (s.insecureRedirects.length || s.slashVariants.insecure.length)
    list.push({
      tone: "bad",
      text: "Some old links send visitors to the insecure (http) version of your site before the secure one. Browsers can warn visitors, and Google prefers sites that are secure throughout.",
      urls: [...s.insecureRedirects, ...s.slashVariants.insecure],
    });
  if (s.slashVariants.broken?.length)
    list.push({ tone: "bad", text: `${s.slashVariants.broken.length} pages show an error if the address is typed with or without the final "/".`, urls: s.slashVariants.broken });
  if (s.slashVariants.duplicates.length)
    list.push({
      tone: "warn",
      text: `${s.slashVariants.duplicates.length} of ${s.slashVariants.checked} pages also load at a second address (with or without the final "/"), so Google sees two copies of the same page.`,
      urls: s.slashVariants.duplicates,
    });
  list.push(
    s.missingCanonical
      ? {
          tone: "warn",
          text: `${s.missingCanonical} of ${s.uniquePages} pages don't tell Google which address is their main one (a "canonical tag"), so Google has to guess between copies.`,
          urls: s.missingCanonicalUrls,
        }
      : { tone: "good", text: "Every page tells Google which address is its main one." },
  );
  list.push(
    s.withSchema
      ? { tone: s.withSchema === s.uniquePages ? "good" : "warn", text: `${s.withSchema} of ${s.uniquePages} pages carry behind-the-scenes labels that tell Google and AI tools what the page is about (structured data).` }
      : { tone: "bad", text: "No page carries the behind-the-scenes labels (structured data) that tell Google and AI tools what the page is about." },
  );
  if (s.repeatedH1OnPage.length) list.push({ tone: "warn", text: "The main headline appears twice on the same page.", urls: s.repeatedH1OnPage });
  if (s.noH1) list.push({ tone: "warn", text: `${pages(s.noH1)} ${s.noH1 === 1 ? "has" : "have"} no main headline.` });
  if (s.multipleH1) list.push({ tone: "warn", text: `${pages(s.multipleH1)} ${s.multipleH1 === 1 ? "has" : "have"} more than one main headline.` });
  if (s.duplicateH1AcrossPages.length)
    list.push({ tone: "warn", text: `${s.duplicateH1AcrossPages.length} main headlines are used on more than one page, so the pages look alike to Google.`, urls: s.duplicateH1AcrossPages.map((d) => `${d.h1} (${d.pages} pages)`) });
  if (s.missingMetaDescription) list.push({ tone: "warn", text: `${pages(s.missingMetaDescription)} ${s.missingMetaDescription === 1 ? "has" : "have"} no summary for Google to show under the link in search results (meta description).` });
  if (s.thinPages) list.push({ tone: "warn", text: `${pages(s.thinPages)} ${s.thinPages === 1 ? "has" : "have"} under 300 words, which is usually too little for Google or AI to treat them as a good answer.` });
  // Listing pages (tags, months) are left out on purpose; audits before 2026-10-28 still have them.
  const gaps = (t.notInSitemap ?? []).filter((g) => g.finalStatus === 200 && !g.softError && !isListingPage(g.url));
  if (gaps.length)
    list.push({
      tone: "warn",
      text: `${gaps.length} pages your site links to are missing from your sitemap, so Google is slower to find them.`,
      urls: gaps.map((g) => g.url),
    });
  const brokenLinks = (t.notInSitemap ?? []).filter((g) => g.finalStatus !== 200 || g.softError);
  if (brokenLinks.length)
    list.push({
      tone: "bad",
      text: `${brokenLinks.length} links on your site lead to pages that don't load.`,
      urls: brokenLinks.map((g) => `${g.url} (${g.softError ? "error page" : g.finalStatus ?? "no answer"})`),
    });
  if (s.helloWorldInSitemap) list.push({ tone: "warn", text: "The \"Hello world!\" sample post that comes with WordPress is still on the site and in your sitemap." });
  const robots = Object.values(t.robotsTxt).some(Boolean);
  const llms = Object.values(t.llmsTxt).some(Boolean);
  list.push({ tone: robots ? "good" : "warn", text: robots ? "Your site has a robots.txt file (instructions for search engines)." : "Your site has no robots.txt file (instructions for search engines)." });
  list.push({ tone: llms ? "good" : "warn", text: llms ? "Your site has an llms.txt file (a short guide for AI tools)." : "Your site has no llms.txt file, a short guide that helps AI tools understand it." });
  if (s.noViewport) list.push({ tone: "warn", text: `${s.noViewport} pages aren't set up to display properly on phones.` });
  if (t.stoppedBecause !== "done") list.push({ tone: "warn", text: `The crawl stopped early (${t.stoppedBecause === "time" ? "time limit" : "500-URL limit"}); results are partial.` });
  return list;
}
