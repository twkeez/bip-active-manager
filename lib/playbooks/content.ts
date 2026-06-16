export type PlaybookIssueType =
  | "relevance"
  | "ctr"
  | "landingPage"
  | "budgetHog"
  | "budgetCap"
  | "qualityScore"
  | "adRank"
  | "conversion"
  | "pixelLoop"
  | "seoCritical"
  | "seoStaleContent";

export type PlaybookSection = {
  id: PlaybookIssueType;
  title: string;
  dotClass: string;
  rootCause: string;
  steps: string[];
  proTip?: string;
};

export const PLAYBOOK_SECTIONS: Record<PlaybookIssueType, PlaybookSection> = {
  relevance: {
    id: "relevance",
    title: 'How to Resolve: "Below Average Ad Relevance"',
    dotClass: "bg-indigo-500",
    rootCause:
      "Google determined that active ad copy headlines do not explicitly mirror the precise keyword text strings being targeted in the ad group.",
    steps: [
      "Open Responsive Search Ads (RSAs) for the flagged ad group in Google Ads.",
      "Write 3–5 alternative headlines containing the targeted search keyword phrases verbatim.",
      "Use Dynamic Keyword Insertion carefully: {KeyWord:Local Vet} — only when landing pages support the variant.",
      "Split mixed-intent keywords into tighter ad groups so each RSA speaks to one theme.",
    ],
    proTip:
      "Pin your highest-scoring keyword-rich headline to Position 1 to force structural alignment while letting remaining slots rotate freely.",
  },
  ctr: {
    id: "ctr",
    title: 'How to Resolve: "Below Average Expected CTR"',
    dotClass: "bg-sky-500",
    rootCause:
      "Google predicts users are unlikely to click your ads versus competitors for the same queries — often due to weak extensions, generic copy, or poor offer clarity.",
    steps: [
      "Audit sitelinks, callouts, and structured snippets; add at least two unique sitelinks per campaign theme.",
      "Rewrite descriptions with specific outcomes (same-day appointments, free consult) instead of generic brand lines.",
      "Test a dedicated RSA variant per high-spend ad group rather than one-size-fits-all assets.",
      "Review auction insights for competitors outranking you on top-of-page rate.",
    ],
    proTip:
      "Expected CTR lifts fastest when headline + extension message match the exact query intent — not when you only raise bids.",
  },
  landingPage: {
    id: "landingPage",
    title: 'How to Resolve: "Landing Page Below Average"',
    dotClass: "bg-violet-500",
    rootCause:
      "The destination URL fails message match, mobile usability, or load-speed expectations relative to the ad promise and keyword intent.",
    steps: [
      "Confirm the keyword's final URL lands on a page that repeats the core query above the fold.",
      "Run PageSpeed / Lighthouse on mobile; fix LCP and CLS regressions on high-spend URLs first.",
      "Remove interstitials and autoplay media that block primary CTA on mobile.",
      "Assign web dev a ticket with keyword, campaign, URL, and 30d spend attached (use Export on PPC Defense).",
    ],
    proTip:
      "One dedicated service page per ad group theme beats a generic homepage for both QS and conversion rate.",
  },
  budgetHog: {
    id: "budgetHog",
    title: 'How to Resolve: "Asymmetric Budget Hog Burn"',
    dotClass: "bg-amber-500",
    rootCause:
      "High-funnel informational or broad-match terms swallow account funding before deeper intent transactional terms can compete in auctions.",
    steps: [
      "Downgrade match type from Broad to Phrase or Exact on the hog keyword immediately.",
      "Pull a 30-day search terms report and negative-match research variants (cost, symptoms, DIY).",
      "Isolate informational queries into a low-budget awareness campaign or pause entirely.",
      "Reallocate freed spend to proven converting terms in a separate exact-match ad group.",
    ],
    proTip:
      "If one keyword exceeds 30% of spend with under two conversions, treat it as a structural account problem — not a bid tweak.",
  },
  budgetCap: {
    id: "budgetCap",
    title: 'How to Resolve: "Budget-Capped Impression Share Loss"',
    dotClass: "bg-red-500",
    rootCause:
      "Daily budget limits stop eligible auctions from running, causing lost impression share due to budget rather than rank.",
    steps: [
      "Confirm lost IS (budget) in campaign report — separate from lost IS (rank).",
      "Model incremental clicks at current CPC before requesting client budget increase.",
      "Shift budget from low-ROAS campaigns to capped high-intent Search campaigns.",
      "Use ad schedule bid adjustments if waste concentrates in low-converting hours.",
    ],
    proTip:
      "Present budget asks with a clicks/recoverable IS estimate — clients approve math, not vague 'we need more budget' requests.",
  },
  qualityScore: {
    id: "qualityScore",
    title: 'How to Resolve: "Low Quality Score (≤ 5/10)"',
    dotClass: "bg-orange-500",
    rootCause:
      "Combined weakness across ad relevance, expected CTR, and landing page experience depresses auction rank and inflates CPC.",
    steps: [
      "Open the keyword diagnosis view and note which QS sub-component is Below Average.",
      "Fix the weakest component first (usually LP or relevance, not bids).",
      "Pause or isolate QS ≤ 4 keywords with spend until assets and URLs are repaired.",
      "Document before/after in the client workspace Ads tab after re-sync.",
    ],
    proTip:
      "Quality Score is a diagnostic label — treat the three components as three separate work orders.",
  },
  adRank: {
    id: "adRank",
    title: 'How to Resolve: "Lost Impression Share (Rank)"',
    dotClass: "bg-rose-500",
    rootCause:
      "Ads lose auctions due to low Ad Rank (QS × bid × expected impact), not insufficient budget.",
    steps: [
      "Improve QS components before raising bids — rank loss from poor QS is expensive to bid away.",
      "Review competitor auction insights for overlap and outranking share.",
      "Tighten keyword-to-ad-to-LP alignment on top-spend ad groups.",
      "Consider segmenting brand vs non-brand if brand terms mask non-brand rank issues.",
    ],
  },
  conversion: {
    id: "conversion",
    title: 'How to Resolve: "Implausible Conversion Rate"',
    dotClass: "bg-pink-500",
    rootCause:
      "Conversion rate exceeds realistic benchmarks for the vertical — often double-counting, page-load triggers, or overly broad conversion actions.",
    steps: [
      "Audit conversion actions in Google Ads — remove micro-goals from primary bidding columns.",
      "Verify GTM/GA4 tags fire once per thank-you page view, not on every page load.",
      "Use Tag Assistant or GTM preview on the live landing URL.",
      "Compare Ads conversions to GA4 key events for the same date range.",
    ],
    proTip:
      "Rates above ~45% with meaningful click volume almost always indicate tracking configuration — not miraculous performance.",
  },
  pixelLoop: {
    id: "pixelLoop",
    title: 'How to Resolve: "Pixel Loop / 1:1 Click-Conversion Match"',
    dotClass: "bg-red-600",
    rootCause:
      "Every click records a conversion — classic sign of a tag firing on page load, duplicate tags, or a conversion action counting all sessions.",
    steps: [
      "Open Tag Assistant on the primary landing and confirmation URLs.",
      "Check for duplicate Google tag or Ads conversion snippets in CMS header/footer.",
      "Ensure conversion linker and consent mode are not re-firing on SPA route changes.",
      "Switch primary bidding to verified lead/form-submit events only after fix.",
    ],
    proTip:
      "Fix tracking before any bid or budget change — optimizing on looped data wastes client spend at scale.",
  },
  seoCritical: {
    id: "seoCritical",
    title: "How to Resolve: Critical SEO Crawl Issues",
    dotClass: "bg-emerald-500",
    rootCause:
      "Technical crawl blockers (indexation, redirects, canonicals, broken templates) prevent pages from ranking or being crawled efficiently.",
    steps: [
      "Open Site Audit for the client and sort issues by critical severity.",
      "Fix indexation blockers on revenue URLs first (noindex, 404 chains, redirect loops).",
      "Validate fixes in Search Console URL Inspection after deploy.",
      "Re-run crawl sync and confirm critical count drops in the workspace SEO tab.",
    ],
    proTip:
      "One critical template bug (e.g. wrong canonical on service pages) beats fifty low-priority warnings — prioritize by URL traffic tier.",
  },
  seoStaleContent: {
    id: "seoStaleContent",
    title: "How to Resolve: Stale / Thin Content Signals",
    dotClass: "bg-teal-500",
    rootCause:
      "Priority URLs lack substantive updates, internal links, or differentiated copy versus competitors.",
    steps: [
      "Identify stale URLs from sitemap lastmod or crawl freshness flags.",
      "Expand thin pages with FAQ blocks, local proof points, and internal links from high-authority pages.",
      "Queue content updates for review before publish.",
      "Request re-crawl via Search Console after meaningful content changes.",
    ],
  },
};

export const GLOBAL_ADS_PLAYBOOK_SECTIONS: PlaybookIssueType[] = [
  "relevance",
  "ctr",
  "qualityScore",
  "budgetCap",
  "adRank",
];

export const PPC_DEFENSE_PLAYBOOK_SECTIONS: PlaybookIssueType[] = [
  "landingPage",
  "budgetHog",
];

export const CONVERSION_INTEGRITY_PLAYBOOK_SECTIONS: PlaybookIssueType[] = [
  "pixelLoop",
  "conversion",
];

export function globalAdsIssueToPlaybook(issueType: string): PlaybookIssueType | null {
  const map: Record<string, PlaybookIssueType> = {
    ad_relevance: "relevance",
    expected_ctr: "ctr",
    low_quality_score: "qualityScore",
    budget_capped: "budgetCap",
    rank_lost: "adRank",
  };
  return map[issueType] ?? null;
}

export function conversionIntegrityToPlaybook(anomalyType: string): PlaybookIssueType | null {
  const map: Record<string, PlaybookIssueType> = {
    pixel_loop: "pixelLoop",
    implausible_rate: "conversion",
  };
  return map[anomalyType] ?? null;
}
