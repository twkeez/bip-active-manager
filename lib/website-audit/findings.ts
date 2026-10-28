import type { TechnicalCrawl } from "@/lib/website-audit/types";

// Shared by the audit screen and the printed report (no server imports here).

export type Finding = { tone: "bad" | "warn" | "good"; text: string; urls?: string[] };

/** Plain-English technical findings, each traceable to the URLs behind it. */
export function technicalFindings(t: TechnicalCrawl): Finding[] {
  const s = t.summary;
  const hosts = Object.entries(s.byHost).map(([host, n]) => `${n} on ${host}`).join(", ");
  const list: Finding[] = [];
  list.push({
    tone: Object.keys(s.byHost).length > 1 ? "warn" : "good",
    text: `The sitemap lists ${s.totalUrls} URLs (${hosts}): ${s.uniquePages} distinct pages once redirects are followed.`,
  });
  if (s.tagPages + s.categoryPages + s.authorPages > 0)
    list.push({ tone: "warn", text: `${s.tagPages} tag, ${s.categoryPages} category and ${s.authorPages} author archive pages are in the sitemap.` });
  if (s.serverErrors.length) list.push({ tone: "bad", text: `${s.serverErrors.length} URLs return a server error.`, urls: s.serverErrors });
  if (s.softErrors?.length)
    list.push({ tone: "bad", text: `${s.softErrors.length} sitemap URLs answer "200 OK" but show an error message instead of the page.`, urls: s.softErrors });
  if (s.notFound.length) list.push({ tone: "bad", text: `${s.notFound.length} URLs return 404.`, urls: s.notFound });
  if (s.redirectLoops.length) list.push({ tone: "bad", text: `${s.redirectLoops.length} URLs are stuck in a redirect loop.`, urls: s.redirectLoops });
  if (s.slashVariants.loops.length)
    list.push({ tone: "bad", text: `${s.slashVariants.loops.length} pages break when the trailing slash is removed or added: the site shows its own "redirect loop detected" error, served as "200 OK", so status-only checkers miss it.`, urls: s.slashVariants.loops });
  if (s.insecureRedirects.length || s.slashVariants.insecure.length)
    list.push({
      tone: "bad",
      text: "Some redirects send visitors from https to insecure http.",
      urls: [...s.insecureRedirects, ...s.slashVariants.insecure],
    });
  if (s.slashVariants.broken?.length)
    list.push({ tone: "bad", text: `${s.slashVariants.broken.length} pages show a server error when the trailing slash is changed.`, urls: s.slashVariants.broken });
  if (s.slashVariants.duplicates.length)
    list.push({
      tone: "warn",
      text: `${s.slashVariants.duplicates.length} of ${s.slashVariants.checked} pages also answer at the other trailing-slash address, so search engines see two copies.`,
      urls: s.slashVariants.duplicates,
    });
  list.push(
    s.missingCanonical
      ? { tone: "warn", text: `${s.missingCanonical} of ${s.uniquePages} pages have no canonical tag.`, urls: s.missingCanonicalUrls }
      : { tone: "good", text: "Every page has a canonical tag." },
  );
  list.push(
    s.withSchema
      ? { tone: s.withSchema === s.uniquePages ? "good" : "warn", text: `${s.withSchema} of ${s.uniquePages} pages have structured data (${s.schemaTypes.join(", ")}).` }
      : { tone: "bad", text: "No page has structured data (schema)." },
  );
  if (s.repeatedH1OnPage.length) list.push({ tone: "warn", text: "The same H1 appears twice on a page.", urls: s.repeatedH1OnPage });
  if (s.noH1) list.push({ tone: "warn", text: `${s.noH1} pages have no H1.` });
  if (s.multipleH1) list.push({ tone: "warn", text: `${s.multipleH1} pages have more than one H1.` });
  if (s.duplicateH1AcrossPages.length)
    list.push({ tone: "warn", text: `${s.duplicateH1AcrossPages.length} H1s are shared by more than one page.`, urls: s.duplicateH1AcrossPages.map((d) => `${d.h1} (${d.pages} pages)`) });
  if (s.missingMetaDescription) list.push({ tone: "warn", text: `${s.missingMetaDescription} pages have no meta description.` });
  if (s.thinPages) list.push({ tone: "warn", text: `${s.thinPages} content pages have under 300 words.` });
  const gaps = (t.notInSitemap ?? []).filter((g) => g.finalStatus === 200 && !g.softError);
  if (gaps.length)
    list.push({
      tone: "warn",
      text: `${gaps.length} pages the site links to are missing from its sitemap, so Google is slower to find them.`,
      urls: gaps.map((g) => g.url),
    });
  const brokenLinks = (t.notInSitemap ?? []).filter((g) => g.finalStatus !== 200 || g.softError);
  if (brokenLinks.length)
    list.push({
      tone: "bad",
      text: `${brokenLinks.length} pages the site links to don't load.`,
      urls: brokenLinks.map((g) => `${g.url} (${g.softError ? "error page" : g.finalStatus ?? "no answer"})`),
    });
  if (s.helloWorldInSitemap) list.push({ tone: "warn", text: "The WordPress \"Hello world\" sample post is still in the sitemap." });
  const robots = Object.values(t.robotsTxt).some(Boolean);
  const llms = Object.values(t.llmsTxt).some(Boolean);
  list.push({ tone: robots ? "good" : "warn", text: robots ? "robots.txt is present." : "No robots.txt." });
  list.push({ tone: llms ? "good" : "warn", text: llms ? "llms.txt is present." : "No llms.txt (a short guide for AI tools)." });
  if (s.noViewport) list.push({ tone: "warn", text: `${s.noViewport} pages lack a mobile viewport tag.` });
  if (t.stoppedBecause !== "done") list.push({ tone: "warn", text: `The crawl stopped early (${t.stoppedBecause === "time" ? "time limit" : "500-URL limit"}); results are partial.` });
  return list;
}
