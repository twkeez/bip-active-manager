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

/** DataForSEO's backlink summary for one domain. `rank` is DataForSEO's own 0–1000 scale, not "Domain Rating". */
export type DomainAuthority = {
  domain: string;
  error: string | null;
  rank: number | null;
  referringDomains: number | null;
  backlinks: number | null;
  spamScore: number | null;
};

export type AuthorityResults = {
  checkedAt: string;
  own: DomainAuthority;
  competitors: DomainAuthority[];
  google: {
    placeId: string | null;
    /** Where the listing id came from; "search" means confirm the listing name below is right. */
    placeSource: "client record" | "search" | null;
    listingName: string | null;
    listingAddress: string | null;
    rating: number | null;
    reviewCount: number | null;
    /** The newest reviews, without reviewer names. */
    reviews: { rating: number | null; text: string | null; date: string | null; ownerAnswered: boolean }[];
    reviewsError: string | null;
  };
  notes: string[];
  costUsd: number;
};

export type AiPlatform = "ai_overview" | "ai_mode" | "chatgpt" | "gemini" | "perplexity" | "claude";

export type AiPrompt = { id: string; kind: "local" | "service" | "informational"; text: string };

/** One prompt asked of one platform. */
export type PromptRun = {
  promptId: string;
  platform: AiPlatform;
  /** False when the platform gave no answer (e.g. Google showed no AI Overview). */
  answered: boolean;
  cited: boolean;
  ownCitations: number;
  ownUrls: string[];
  /** The practice named in the answer text. */
  mentioned: boolean;
  citedDomains: string[];
  answerExcerpt: string;
  error: string | null;
};

export type PlatformSummary = {
  platform: AiPlatform;
  label: string;
  model: string | null;
  promptsPlanned: number;
  promptsRun: number;
  promptsAnswered: number;
  promptsCited: number;
  promptsMentioned: number;
  citations: number;
};

type MentionTotals = { mentions: number; aiSearchVolume: number; byPlatform: Record<string, number>; error: string | null };

/** DataForSEO's LLM Mentions database: observed answers, not our prompts. */
export type MentionsDatabase = {
  window: string;
  /** Answers citing the practice's website as a source. */
  citedAsSource: MentionTotals;
  /** Answers naming the practice. */
  namedInAnswers: MentionTotals;
  examples: { platform: string; question: string; answerExcerpt: string; citedUrl: string | null; aiSearchVolume: number | null }[];
  error: string | null;
};

export type AiVisibilityResults = {
  ranAt: string;
  profile: "consumer" | "economy";
  /** Google location used for AI Overview and AI Mode. */
  location: string;
  prompts: AiPrompt[];
  runs: PromptRun[];
  /** Model (or source) used per platform, for the methodology appendix. */
  models: Partial<Record<AiPlatform, string>>;
  platforms: PlatformSummary[];
  mentions: MentionsDatabase;
  topCitedDomains: { domain: string; answers: number }[];
  /** False while some prompt/platform pairs are still unanswered (run the step again). */
  complete: boolean;
  missing: number;
  errors: string[];
  costUsd: number;
};

export type PageType = "home" | "service" | "team" | "about" | "blog_post" | "other";

/** What Claude read on one page (Section 4). Every item is as written on that page. */
export type PageContent = {
  url: string;
  pageType: PageType;
  doctors: { name: string; credentials: string | null; hasBio: boolean; school: string | null; year: string | null }[];
  servicesNamed: string[];
  hours: string | null;
  booking: string | null;
  emergencyReferral: string | null;
  paymentInfo: string | null;
  pricesShown: string[];
  accreditations: string[];
  hasFaq: boolean;
  /** Blog posts only. */
  blog: { questionHeading: boolean; authorNamed: string | null; dateShown: string | null; linksToServicePage: boolean } | null;
  typos: { text: string; suggestion: string; where: string }[];
  currentH1: string | null;
  recommendedH1: string;
  /** An existing tagline kept as a line under the new H1. */
  secondaryLine: string | null;
  error: string | null;
};

/** Each claim cites what supports it: a page URL or a review. */
export type Evidence = { source: string; quote: string };

export type SiteContent = {
  differentiators: { title: string; detail: string; evidence: Evidence[] }[];
  positioningLine: string;
  homepageH1: string;
  fixes: { rank: number; fix: string; whyItMatters: string; evidence: Evidence[]; area: string }[];
  servicesWithoutPage: string[];
  menuItemsGoingNowhere: string[];
  hoursContradictions: string[];
  error: string | null;
};

export type ContentResults = {
  ranAt: string;
  pageModel: string;
  siteModel: string;
  pages: PageContent[];
  site: SiteContent;
  costUsd: number;
};

export type SubScore = {
  key: string;
  label: string;
  weight: number;
  points: number;
  /** What earned or lost points, in plain English, each traceable to the results. */
  details: string[];
};

export type CitabilityScore = {
  computedAt: string;
  total: number;
  band: string;
  subScores: SubScore[];
  weightsVersion: string;
};

export type AuditResults = {
  technical?: TechnicalCrawl;
  authority?: AuthorityResults;
  aiVisibility?: AiVisibilityResults;
  content?: ContentResults;
  score?: CitabilityScore;
};

export const AUDIT_STAGES = ["crawl", "authority", "ai-visibility", "content"] as const;
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
  score: number | null;
};
