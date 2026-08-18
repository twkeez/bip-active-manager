export type DataForSeoAction =
  | "keyword_gap"
  | "blog_ideas"
  | "local_rank"
  | "competitor_lookup";

export type KeywordGapType = "missing" | "weak" | "shared";

export type KeywordGapRow = {
  id: number;
  keyword: string;
  volume: number;
  difficulty: string;
  clientRank: number | string;
  compRank: number | string;
  type: KeywordGapType;
};

export type BlogIdeaRow = {
  id: number;
  question: string;
  source: "keyword_idea" | "people_also_ask";
  volume: number | null;
  difficulty: string | null;
};

export type LocalRankRow = {
  id: number;
  rank: number;
  title: string;
  domain: string | null;
  phone: string | null;
  isMatch: boolean;
};

export type CompetitorRow = {
  id: number;
  domain: string;
  avgPosition: number;
  intersections: number;
  organicKeywords: number;
  estimatedTraffic: number;
};

// Backlinks — who links to a client site. Sourced from the DataForSEO
// Backlinks API, which is billed separately from the Labs/SERP endpoints
// (~2.4c per call), so lookups are always user-initiated, never on mount.
export type BacklinkSummary = {
  target: string;
  rank: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  referringMainDomains: number | null;
  referringDomainsNofollow: number | null;
  brokenBacklinks: number | null;
  spamScore: number | null;
  firstSeen: string | null;
  cms: string | null;
};

export type BacklinkRow = {
  id: number;
  domainFrom: string;
  urlFrom: string;
  urlTo: string;
  pageTitle: string | null;
  anchor: string | null;
  dofollow: boolean;
  spamScore: number | null;
  domainRank: number | null;
  linksFromDomain: number;
  isLost: boolean;
  isNew: boolean;
  isBroken: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
};

export type DataForSeoRequestBody = {
  action?: DataForSeoAction;
  clientDomain?: string;
  competitorDomain?: string;
  seedKeyword?: string;
  businessName?: string;
  city?: string;
  targetDomain?: string;
};
