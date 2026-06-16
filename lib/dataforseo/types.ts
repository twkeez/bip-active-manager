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

export type DataForSeoRequestBody = {
  action?: DataForSeoAction;
  clientDomain?: string;
  competitorDomain?: string;
  seedKeyword?: string;
  businessName?: string;
  city?: string;
  targetDomain?: string;
};
