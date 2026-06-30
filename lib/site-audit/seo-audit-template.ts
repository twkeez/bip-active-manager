import type { AuditReportJson, CrawlStageResult } from "@/lib/site-audit/types";

// ── Template shape ───────────────────────────────────────────────────────────
// Mirrors the Beyond Indigo Pets "SEO Site Audit" Word template. The static
// scaffold (SEO_AUDIT_TEMPLATE) defines section numbers, titles, and the items
// that carry a Good / Needs Work / Critical rating. buildTemplateFromReport maps
// an automated audit run onto that scaffold; the prose/competitor/SWOT fields are
// drafted separately (seo-audit-ai.ts) or filled by the strategist.

export type AuditRating = "good" | "needs_work" | "critical";
export type RecommendationPriority = "high" | "med" | "low";
export type PackageTier = "Foundation" | "Premium" | "Premium Plus";

export type RatedItem = {
  key: string;
  label: string;
  /** null = not assessed automatically; the strategist fills it in. */
  rating: AuditRating | null;
  notes: string;
};

export type RatedSection = {
  id: string;
  number: string;
  title: string;
  intro: string;
  items: RatedItem[];
};

export type SeoAuditMeta = {
  client: string;
  website: string;
  auditDate: string;
  preparedBy: string;
  packageTier: PackageTier | null;
};

export type SeoAuditTemplateData = {
  meta: SeoAuditMeta;
  executiveSummary: string;
  topPriorities: string[];
  ratedSections: RatedSection[];
  contentOpportunities: string;
  keywords: {
    targetKeywords: string;
    competitors: string[];
    swot: { strengths: string; weaknesses: string; opportunities: string; threats: string };
  };
  recommendations: Array<{ recommendation: string; priority: RecommendationPriority | null; owner: string }>;
};

type SectionScaffold = {
  id: string;
  number: string;
  title: string;
  intro: string;
  items: Array<{ key: string; label: string }>;
};

/** The five rated sections (02–06). Manual sections (05) carry no auto rating. */
export const SEO_AUDIT_RATED_SECTIONS: SectionScaffold[] = [
  {
    id: "critical_issues",
    number: "02",
    title: "Critical Issues to Address First",
    intro: "Anything broken, blocking indexing, or actively losing traffic.",
    items: [
      { key: "broken_links", label: "Broken links / 404 errors" },
      { key: "indexing", label: "Indexing issues (robots.txt, noindex tags)" },
      { key: "mobile_usability", label: "Mobile usability errors" },
      { key: "ssl_https", label: "SSL / HTTPS issues" },
      { key: "duplicate_canonical", label: "Duplicate content / canonical issues" },
      { key: "redirect_chains", label: "Site-wide redirect chains" },
    ],
  },
  {
    id: "performance",
    number: "03",
    title: "Performance & Page Speed",
    intro: "From PageSpeed Insights / Core Web Vitals.",
    items: [
      { key: "core_web_vitals", label: "Core Web Vitals (LCP, INP, CLS)" },
      { key: "mobile_speed", label: "Mobile page speed score" },
      { key: "desktop_speed", label: "Desktop page speed score" },
      { key: "image_optimization", label: "Image optimization / compression" },
      { key: "js_css_bloat", label: "Unused JS/CSS bloat" },
    ],
  },
  {
    id: "on_page",
    number: "04",
    title: "On-Page SEO",
    intro: "Spot-checked against the homepage and priority pages.",
    items: [
      { key: "title_tags", label: "Title tags (unique, keyword-aligned, right length)" },
      { key: "meta_descriptions", label: "Meta descriptions present & compelling" },
      { key: "heading_structure", label: "H1/H2 structure logical" },
      { key: "image_alt", label: "Image alt text present" },
      { key: "internal_linking", label: "Internal linking present" },
      { key: "url_structure", label: "URL structure clean" },
    ],
  },
  {
    id: "local_trust",
    number: "05",
    title: "Local SEO & Trust",
    intro: "Confirm NAP consistency and review signals (manual review).",
    items: [
      { key: "gbp", label: "Google Business Profile claimed & optimized" },
      { key: "nap", label: "NAP consistency across web" },
      { key: "citations", label: "Citations / directory listings" },
      { key: "reviews", label: "Review volume & rating" },
      { key: "local_schema", label: "Local schema markup present" },
    ],
  },
  {
    id: "technical",
    number: "06",
    title: "Technical SEO",
    intro: "Crawlability, sitemap health, and structured data.",
    items: [
      { key: "xml_sitemap", label: "XML sitemap present & submitted" },
      { key: "robots_txt", label: "Robots.txt configured correctly" },
      { key: "structured_data", label: "Schema / structured data present" },
      { key: "crawl_errors", label: "Crawl errors" },
      { key: "site_architecture", label: "Site architecture / crawl depth" },
    ],
  },
];

/** Item keys (section 05) we never auto-rate — they need human judgement. */
export const MANUAL_ITEM_KEYS = new Set([
  "gbp",
  "nap",
  "citations",
  "reviews",
  "local_schema",
  "desktop_speed",
]);

// ── Rating heuristics ────────────────────────────────────────────────────────

function countIssues(crawl: CrawlStageResult | undefined, ruleId: string): number {
  if (!crawl) return 0;
  return crawl.issues.filter((issue) => issue.rule_id === ruleId).length;
}

/** Fewer problems is better: 0 → good, 1..needsWorkMax → needs_work, more → critical. */
function rateByCount(count: number, needsWorkMax = 2): AuditRating {
  if (count <= 0) return "good";
  if (count <= needsWorkMax) return "needs_work";
  return "critical";
}

/** Lighthouse 0–100 score → rating. null when the stage didn't run. */
function rateScore(score: number | null | undefined): AuditRating | null {
  if (score == null) return null;
  if (score >= 90) return "good";
  if (score >= 50) return "needs_work";
  return "critical";
}

function findingsMatch(report: AuditReportJson, pattern: RegExp): boolean {
  return (report.lighthouse?.findings ?? []).some(
    (f) => pattern.test(f.id) || pattern.test(f.title),
  );
}

function item(key: string, label: string, rating: AuditRating | null, notes: string): RatedItem {
  return { key, label, rating, notes };
}

function buildCriticalIssues(report: AuditReportJson): RatedItem[] {
  const crawl = report.crawl;
  const pages = crawl?.pages ?? [];
  const broken = pages.filter((p) => p.status === 0 || p.status >= 400).length
    + countIssues(crawl, "request-failed")
    + countIssues(crawl, "http-status");
  const redirects = pages.filter((p) => p.status >= 300 && p.status < 400).length
    + countIssues(crawl, "redirected-page");
  const noindex = countIssues(crawl, "noindex-present");
  const missingCanonical = countIssues(crawl, "missing-canonical");
  const robotsAllowsAll = report.discovery?.robotsTxt?.allowsAll;
  const finalUrl = report.discovery?.finalUrl ?? report.discovery?.normalizedUrl ?? "";

  const indexingRating: AuditRating | null = !crawl && !report.discovery
    ? null
    : noindex > 0
      ? "critical"
      : robotsAllowsAll === false
        ? "needs_work"
        : "good";

  const sslRating: AuditRating | null = finalUrl
    ? finalUrl.startsWith("https://")
      ? "good"
      : "critical"
    : null;

  return [
    item("broken_links", "Broken links / 404 errors", crawl ? rateByCount(broken) : null,
      crawl ? `${broken} broken or non-200 page(s) found in crawl.` : ""),
    item("indexing", "Indexing issues (robots.txt, noindex tags)", indexingRating,
      noindex > 0 ? `${noindex} page(s) marked noindex.` : robotsAllowsAll === false ? "robots.txt restricts crawling." : ""),
    item("mobile_usability", "Mobile usability errors", null,
      "Confirm in Google Search Console (Mobile Usability)."),
    item("ssl_https", "SSL / HTTPS issues", sslRating,
      sslRating === "critical" ? "Site is not served over HTTPS." : ""),
    item("duplicate_canonical", "Duplicate content / canonical issues", crawl ? rateByCount(missingCanonical) : null,
      crawl ? `${missingCanonical} page(s) missing a canonical link.` : ""),
    item("redirect_chains", "Site-wide redirect chains", crawl ? rateByCount(redirects) : null,
      crawl ? `${redirects} redirecting page(s) observed.` : ""),
  ];
}

function buildPerformance(report: AuditReportJson): RatedItem[] {
  const lh = report.lighthouse;
  const perf = lh?.scores.performance ?? null;
  const m = lh?.metrics;
  const cwvNotes = m ? `LCP ${m.lcp ?? "—"}, CLS ${m.cls ?? "—"}, TBT ${m.tbt ?? "—"}.` : "";
  const imageRating: AuditRating | null = lh
    ? findingsMatch(report, /image|webp|responsive-images|offscreen/i) ? "needs_work" : "good"
    : null;
  const bloatRating: AuditRating | null = lh
    ? findingsMatch(report, /unused-(javascript|css)|unminified|legacy-javascript/i) ? "needs_work" : "good"
    : null;

  return [
    item("core_web_vitals", "Core Web Vitals (LCP, INP, CLS)", rateScore(perf), cwvNotes),
    item("mobile_speed", "Mobile page speed score", rateScore(perf), perf != null ? `Lighthouse performance score: ${perf}.` : ""),
    item("desktop_speed", "Desktop page speed score", null, "Run desktop PageSpeed Insights separately."),
    item("image_optimization", "Image optimization / compression", imageRating, ""),
    item("js_css_bloat", "Unused JS/CSS bloat", bloatRating, ""),
  ];
}

function buildOnPage(report: AuditReportJson): RatedItem[] {
  const crawl = report.crawl;
  const pages = crawl?.pages ?? [];
  const missingTitle = countIssues(crawl, "missing-title");
  const longTitle = countIssues(crawl, "long-title");
  const missingMeta = countIssues(crawl, "missing-meta-description");
  const missingH1 = countIssues(crawl, "missing-h1");
  const multiH1 = countIssues(crawl, "multiple-h1");
  const missingAlt = countIssues(crawl, "missing-image-alt");

  const messyUrls = pages.filter((p) => /[A-Z]|_|\?|%20| /.test(new URL(p.url, "https://x").pathname)).length;

  return [
    item("title_tags", "Title tags (unique, keyword-aligned, right length)",
      crawl ? rateByCount(missingTitle + longTitle) : null,
      crawl ? `${missingTitle} missing, ${longTitle} over length.` : ""),
    item("meta_descriptions", "Meta descriptions present & compelling",
      crawl ? rateByCount(missingMeta) : null,
      crawl ? `${missingMeta} page(s) missing a meta description.` : ""),
    item("heading_structure", "H1/H2 structure logical",
      crawl ? rateByCount(missingH1 + multiH1) : null,
      crawl ? `${missingH1} missing H1, ${multiH1} with multiple H1s.` : ""),
    item("image_alt", "Image alt text present",
      crawl ? rateByCount(missingAlt, 4) : null,
      crawl ? `${missingAlt} image(s) missing alt text.` : ""),
    item("internal_linking", "Internal linking present",
      crawl ? (pages.length > 1 ? "good" : "needs_work") : null,
      crawl ? `${pages.length} internal page(s) reached via crawl.` : ""),
    item("url_structure", "URL structure clean",
      crawl ? rateByCount(messyUrls) : null,
      crawl ? `${messyUrls} URL(s) with mixed case, spaces, or query strings.` : ""),
  ];
}

function buildLocalTrust(): RatedItem[] {
  // No reliable automated source — left for the strategist's manual review.
  return SEO_AUDIT_RATED_SECTIONS[3].items.map((i) => item(i.key, i.label, null, ""));
}

function buildTechnical(report: AuditReportJson): RatedItem[] {
  const crawl = report.crawl;
  const pages = crawl?.pages ?? [];
  const sitemap = report.sitemap;
  const robotsFound = report.discovery?.robotsTxt?.found;
  const schemaPages = report.schema?.pagesWithSchema ?? 0;
  const broken = pages.filter((p) => p.status === 0 || p.status >= 400).length;
  const maxDepth = pages.reduce((max, p) => Math.max(max, p.depth), 0);

  const sitemapRating: AuditRating | null = sitemap
    ? sitemap.found ? (sitemap.urlCount > 0 ? "good" : "needs_work") : "critical"
    : null;

  return [
    item("xml_sitemap", "XML sitemap present & submitted", sitemapRating,
      sitemap?.found ? `${sitemap.urlCount} URL(s) in sitemap.` : sitemap ? "No XML sitemap found." : ""),
    item("robots_txt", "Robots.txt configured correctly",
      robotsFound == null ? null : robotsFound ? "good" : "needs_work",
      robotsFound === false ? "No robots.txt found." : ""),
    item("structured_data", "Schema / structured data present",
      report.schema ? (schemaPages > 0 ? "good" : "needs_work") : null,
      report.schema ? `${schemaPages} page(s) with structured data.` : ""),
    item("crawl_errors", "Crawl errors",
      crawl ? rateByCount(broken) : null,
      crawl ? `${broken} crawl error(s) observed.` : ""),
    item("site_architecture", "Site architecture / crawl depth",
      crawl ? (maxDepth <= 3 ? "good" : "needs_work") : null,
      crawl ? `Max crawl depth reached: ${maxDepth}.` : ""),
  ];
}

function buildTargetKeywords(report: AuditReportJson): string {
  const kw = report.keywords;
  if (!kw) return "";
  if (kw.source === "gsc" && kw.topQueries?.length) {
    return kw.topQueries.slice(0, 5).map((q) => q.query).join(", ");
  }
  if (kw.aiKeywords?.length) {
    return kw.aiKeywords.slice(0, 5).map((k) => k.keyword).join(", ");
  }
  return "";
}

export type BuildTemplateOptions = {
  client: string;
  website: string;
  auditDate: string;
  preparedBy: string;
  packageTier?: PackageTier | null;
};

/**
 * Maps an automated audit run's report onto the SEO audit template, filling the
 * Good/Needs Work/Critical ratings and notes. Prose, competitors, and SWOT are
 * left blank here — drafted by AI or the strategist.
 */
export function buildTemplateFromReport(
  report: AuditReportJson,
  opts: BuildTemplateOptions,
): SeoAuditTemplateData {
  const ratedSections: RatedSection[] = [
    { ...sectionMeta(0), items: buildCriticalIssues(report) },
    { ...sectionMeta(1), items: buildPerformance(report) },
    { ...sectionMeta(2), items: buildOnPage(report) },
    { ...sectionMeta(3), items: buildLocalTrust() },
    { ...sectionMeta(4), items: buildTechnical(report) },
  ];

  return {
    meta: {
      client: opts.client,
      website: opts.website,
      auditDate: opts.auditDate,
      preparedBy: opts.preparedBy,
      packageTier: opts.packageTier ?? null,
    },
    executiveSummary: "",
    topPriorities: ["", "", ""],
    ratedSections,
    contentOpportunities: "",
    keywords: {
      targetKeywords: buildTargetKeywords(report),
      competitors: ["", "", ""],
      swot: { strengths: "", weaknesses: "", opportunities: "", threats: "" },
    },
    recommendations: [],
  };
}

function sectionMeta(index: number) {
  const s = SEO_AUDIT_RATED_SECTIONS[index];
  return { id: s.id, number: s.number, title: s.title, intro: s.intro };
}

/** An empty, fully-scaffolded template (no run yet) — used by the editor. */
export function emptyTemplate(opts: BuildTemplateOptions): SeoAuditTemplateData {
  return buildTemplateFromReport({}, opts);
}
