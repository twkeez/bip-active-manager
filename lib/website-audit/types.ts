// The Website, SEO & AI Search Audit's results: one JSON document per run
// (website_audits.results), filled section by section as each step runs.

export type RedirectHop = { url: string; status: number };

/** "redirect-loop": the site's own "SELF-REDIRECT LOOP DETECTED" page; "server-error": a PHP error or backtrace. */
export type SoftError = "redirect-loop" | "server-error";

export type CrawlPage = {
  /** As listed in the sitemap. */
  url: string;
  host: string;
  sitemap: string;
  chain: RedirectHop[];
  redirectLoop: boolean;
  finalUrl: string;
  /** null for a redirect loop, 0 when the request failed. */
  finalStatus: number | null;
  error: string | null;
  archiveType: "tag" | "category" | "author" | null;
  /** Answered 200 but the page is a server error message (see crawl.ts softErrorOf). */
  softError: SoftError | null;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1s: string[];
  h2Count: number;
  wordCount: number;
  canonical: string | null;
  canonicalMatches: boolean | null;
  canonicalMatchesIgnoringSlash: boolean | null;
  schemaTypes: string[];
  hreflang: string[];
  robotsMeta: string | null;
  https: boolean;
  hasViewport: boolean;
  /** Visible text, for the content pass. */
  text: string;
  navLinks: { text: string; href: string }[];
  /** Links to other pages on the same site (absolute, no #fragment). */
  links: string[];
};

export type CrawlSummary = {
  domain: string;
  totalUrls: number;
  byHost: Record<string, number>;
  statusCounts: Record<string, number>;
  tagPages: number;
  categoryPages: number;
  authorPages: number;
  redirected: number;
  redirectLoops: string[];
  serverErrors: string[];
  /** Answer 200 OK but show an error message instead of the page. */
  softErrors: string[];
  notFound: string[];
  fetchErrors: string[];
  pagesOk: number;
  missingCanonical: number;
  canonicalMismatch: number;
  withSchema: number;
  schemaTypes: string[];
  noH1: number;
  multipleH1: number;
  repeatedH1OnPage: string[];
  duplicateH1AcrossPages: { h1: string; pages: number }[];
  missingTitle: number;
  missingMetaDescription: number;
  noViewport: number;
  notHttps: number;
  noindex: string[];
  helloWorldInSitemap: boolean;
  thinPages: number;
  /** Distinct pages after redirects (the bare and www copies of a page count once). */
  uniquePages: number;
  missingCanonicalUrls: string[];
  /** A redirect hop that drops from https to http. */
  insecureRedirects: string[];
  /** The same page with the trailing slash added or removed. */
  slashVariants: {
    checked: number;
    /** A redirect loop, or a 200 whose page is the site's redirect-loop error. */
    loops: string[];
    /** A 200 whose page is some other server error. */
    broken: string[];
    /** Answers 200 with the real page at both addresses: two copies of one page. */
    duplicates: string[];
    insecure: string[];
  };
};

export type SlashVariantCheck = {
  pageUrl: string;
  variantUrl: string;
  chain: RedirectHop[];
  loop: boolean;
  finalStatus: number | null;
  softError: SoftError | null;
};

export type TechnicalCrawl = {
  crawledAt: string;
  domain: string;
  homepageChain: RedirectHop[];
  robotsTxt: Record<string, boolean>;
  llmsTxt: Record<string, boolean>;
  sitemapsRead: string[];
  sitemapErrors: string[];
  sitemapUrlCount: number;
  stoppedBecause: "done" | "time" | "limit";
  pages: CrawlPage[];
  slashVariants: SlashVariantCheck[];
  /** Pages the site links to that its sitemap leaves out. */
  notInSitemap: SitemapGap[];
  summary: CrawlSummary;
  ms: number;
};

export type SitemapGap = {
  url: string;
  /** Up to 5 pages that link to it. */
  linkedFrom: string[];
  finalStatus: number | null;
  softError: SoftError | null;
};

export type AuditResults = {
  technical?: TechnicalCrawl;
};

export const AUDIT_STAGES = ["crawl"] as const;
export type AuditStage = (typeof AUDIT_STAGES)[number];

export type StageState = { status: "running" | "done" | "failed"; at: string; error?: string };

export type WebsiteAuditRow = {
  id: number;
  created_at: string;
  created_by: string | null;
  client_id: number | null;
  domain: string;
  practice_name: string;
  city: string | null;
  state: string | null;
  competitors: string[];
  stage_status: Partial<Record<AuditStage, StageState>>;
  results: AuditResults;
  dataforseo_cost_usd: number;
  ai_cost_usd: number;
};
