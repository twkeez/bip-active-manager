export type StrategyMapperService = "seo" | "ppc" | "orm" | "social";

export type DensityTier = "urban" | "suburban" | "rural";

export type ClientPersonaTone = "standard" | "no-nonsense";

/** Website / platform situation — drives marketing scope copy variants */
export type SiteContext =
  | "existing_active"
  | "launching_external_builder"
  | "replacement_build_in_progress"
  | "brand_new_ground_up";

export type PrimaryBusinessGoal =
  | "Fill a new associate veterinarian's calendar"
  | "Increase high-ticket dental, surgical, or therapeutic procedures"
  | "Reputation management/Repair negative search presence"
  | "General new client acquisition / Market dominance";

export type UpsellFraming =
  | "optimization"
  | "introduction"
  | "reputation_gap"
  | "community";

export interface UpsellDirective {
  service: StrategyMapperService;
  framing: UpsellFraming;
}

export interface SalesPdfExtract {
  summary: string;
  painPoints: string[];
  goals: string[];
  agencyFrustrations: string[];
  /** Services found in Purchased Products/Services table — drives Phase 1 vs Phase 2 */
  purchasedServices: StrategyMapperService[];
  /** Raw labels from purchased products table (e.g. "ORM Premium Plus") */
  purchasedProductLabels: string[];
  clinicalDifferentiator: string;
  /** Named high-ticket procedures from sales notes (e.g. "TPLO") */
  primaryProcedures: string[];
  clientRunsOwnAds: boolean;
  adsPerformanceNote: string;
  vendorPlatforms: string[];
  ormProgramName: string;
  socialContentThemes: string[];
  primarySocialPlatform: string;
  socialAdsHistory: string;
  operationalBottlenecks: string[];
  capacityNotes: string;
  vendorFrustrations: string[];
  staffConstraints: string;
  doctorCount: string;
  clientPersonaTone: ClientPersonaTone;
}

export interface SalesPdfReference {
  fileName: string;
  storagePath: string;
  uploadedAt: string;
}

export interface StrategyMapperFormData {
  practiceName: string;
  practiceOwnerName: string;
  streetAddress: string;
  locationNotes: string;
  specializations: string[];
  customSpecialization: string;
  activeServices: StrategyMapperService[];
  primaryGoal: PrimaryBusinessGoal | "";
  /** Default: existing_active — only brand_new_ground_up allows web-dev framing */
  siteContext?: SiteContext;
  strategicContextNotes: string;
  /** Manually entered sales context (replaces AI PDF extraction) */
  salesPdfExtract?: SalesPdfExtract;
  /** Reference-only sales document stored in Supabase Storage */
  salesPdfReference?: SalesPdfReference;
  logoDataUrl?: string;
  clientGoogleRating?: string;
  clientReviewCount?: string;
  /** Manual override when product label does not resolve to a tier */
  tierOverrides?: Partial<Record<StrategyMapperService, string>>;
  /** Current practice website — used for SEO red-flag audit */
  websiteUrl?: string;
}

export type WebsiteSeoAuditMode = "fix_now" | "pre_launch_baseline";

export interface WebsiteSeoAuditIssue {
  id: string;
  severity: "critical" | "watch";
  title: string;
  description: string;
  recommendation?: string;
  url?: string | null;
}

export interface WebsiteSeoKeywordCoverage {
  keyword: string;
  foundIn: string[];
}

export interface WebsiteSeoAuditResult {
  url: string;
  finalUrl: string;
  auditMode: WebsiteSeoAuditMode;
  skipped?: boolean;
  homepage: {
    title: string | null;
    metaDescription: string | null;
    h1Count: number;
    canonical: string | null;
    issues: WebsiteSeoAuditIssue[];
  };
  crawl: {
    pagesScanned: number;
    issueCount: number;
    topIssues: WebsiteSeoAuditIssue[];
  };
  lighthouse?: {
    scores: {
      performance: number | null;
      seo: number | null;
      accessibility: number | null;
      bestPractices: number | null;
    };
    seoBlockers: WebsiteSeoAuditIssue[];
  };
  keywordAlignment: {
    matrixRows: KeywordMatrixRow[];
    coverage: WebsiteSeoKeywordCoverage[];
    gaps: string[];
    aiSummary?: string;
  };
  redFlagSummary: string[];
}

export interface WebsiteSeoReportSection {
  sectionTitle: string;
  framingNote: string;
  redFlagSummary: string[];
  homepageTitle: string | null;
  homepageMetaDescription: string | null;
  homepageIssues: WebsiteSeoAuditIssue[];
  crawlIssueCount: number;
  topCrawlIssues: WebsiteSeoAuditIssue[];
  lighthouseSeoScore: number | null;
  keywordGaps: string[];
  keywordCoverage: WebsiteSeoKeywordCoverage[];
}

export interface DualRadiusResult {
  densityTier: DensityTier;
  wellnessRadiusMiles: 3 | 5 | 15;
  specialtyRadiusMiles: number | null;
  specialtyRadiusEnabled: boolean;
  geographicFocusLabel: string;
  rationale: string;
}

/** @deprecated Use DualRadiusResult */
export type TargetRadiusResult = DualRadiusResult;

export interface StrategyMapperClientMetrics {
  googleRating: number;
  reviewCount: number;
  runsGoogleAds: boolean;
}

export interface StrategyMapperCompetitor {
  name: string;
  distanceMiles: number;
  googleRating: number;
  reviewCount: number;
  runsGoogleAds: boolean;
  scope: "local" | "regional";
}

export interface StrategyMapperResearch {
  densityTier: DensityTier;
  wellnessRadiusMiles: number;
  specialtyRadiusMiles: number | null;
  specialtyRadiusEnabled: boolean;
  radiusRationale: string;
  clientMetrics: StrategyMapperClientMetrics;
  competitors: StrategyMapperCompetitor[];
}

export interface CompetitiveAuditRow {
  practiceName: string;
  isClient: boolean;
  distance: string;
  googleRating: string;
  reviewCount: string;
  runsGoogleAds: string;
}

export interface KeywordMatrixRow {
  intentCategory: string;
  targetGeography: string;
  keywordVariations: string[];
}

export interface ActiveStrategyBlock {
  title: string;
  objective: string;
  tactics: string[];
}

export interface GrowthOpportunityBlock {
  service: StrategyMapperService;
  title: string;
  marketObservation: string;
  whyItMatters: string;
  framing?: UpsellFraming;
}

export interface LaunchRoadmapStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface StrategyMapperReport {
  executiveSummary: {
    missionStatement: string;
    narrative: string;
    painPointResolution: string;
    coreFocusAreas: string[];
  };
  competitiveAuditRows: CompetitiveAuditRow[];
  seoKeywordMatrix: KeywordMatrixRow[];
  activeStrategies: Partial<Record<StrategyMapperService, ActiveStrategyBlock>>;
  growthOpportunities: GrowthOpportunityBlock[];
  launchRoadmap: LaunchRoadmapStep[];
  internalStrategistChecklist: string[];
  websiteSeoAudit?: WebsiteSeoReportSection;
}

import type { ClientContext } from "@/types/client-context";

export interface StrategyMapperGenerateResult {
  research: StrategyMapperResearch;
  report: StrategyMapperReport;
  upsellDirectives: UpsellDirective[];
  radius: DualRadiusResult;
  activeServices: StrategyMapperService[];
  clientContext?: ClientContext;
  websiteAudit?: WebsiteSeoAuditResult;
}

export interface StrategyMapperPreCheckRequest {
  form: StrategyMapperFormData;
  useMockResearch?: boolean;
}

export interface StrategyMapperPreCheckResult {
  research: StrategyMapperResearch;
  radius: DualRadiusResult;
  activeServices: StrategyMapperService[];
  clientContext: ClientContext;
  mockMode?: boolean;
  mockFallbackReason?: string;
}

export interface StrategyMapperGenerateRequest {
  form: StrategyMapperFormData;
  research: StrategyMapperResearch;
  websiteAudit?: WebsiteSeoAuditResult;
}

export interface StrategyMapperWebsiteAuditRequest {
  form: StrategyMapperFormData;
  research: StrategyMapperResearch;
  radius: DualRadiusResult;
  activeServices: StrategyMapperService[];
}

export interface StrategyMapperStagingState {
  form: StrategyMapperFormData;
  research: StrategyMapperResearch;
  radius: DualRadiusResult;
  activeServices: StrategyMapperService[];
  websiteAudit?: WebsiteSeoAuditResult;
  mockMode?: boolean;
  mockFallbackReason?: string;
}
