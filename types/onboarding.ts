export interface ClientFormData {
  practiceName: string;
  contactName: string;
  location: string;
  practiceType: string;
  numVets: string;
  services: string[];
  mainGoal: string;
  challenge: string;
  budget: string;
  timeline: string;
  presence: string;
  notes: string;
  websiteUrl: string;
  /** One Google Business Profile URL per line */
  googleBusinessProfileUrls: string;
  facebookUrl: string;
  instagramUrl: string;
  /** One social profile URL per line (YouTube, TikTok, etc.) */
  otherSocialUrls: string;
  practicePhone: string;
  onlineBookingUrl: string;
  serviceAreaNotes: string;
  marketingManagedBy: string;
  previousAgencyName: string;
  /** Specific goals extracted from an uploaded intake document */
  intakeGoals: string[];
  /** Narrative summary of client priorities from intake document */
  intakeSummary: string;
}

export interface CompetitorEntry {
  name: string;
  note: string;
}

export interface LocalResearch {
  competitors: CompetitorEntry[];
  marketSnapshot: string;
  searchLandscape: string;
}

export interface OnboardingPlan {
  welcome: string;
  whyItMatters: string;
  stats: Array<{ num: string; label: string }>;
  serviceStrategy: string;
  /** How the plan directly addresses the client's stated goals */
  goalsPlan: string;
  competitors: CompetitorEntry[];
  marketSnapshot: string;
  searchLandscape: string;
  roadmap: Array<{ phase: string; title: string; actions: string[] }>;
  quickWins: string[];
  nextSteps: string[];
}

export interface DiscoveryFormData {
  clientFocus: string;
  bookingAvailability: string;
  differentiators: string[];
  differentiatorOther: string;
  avgTransactionValue: string;
  customerLifetimeValue: string;
  googleRating: string;
  googleReviewCount: string;
  reviewResponseHabit: string;
  mobileFriendly: string;
  onlineBooking: string;
  practiceSoftware: string;
  clinicSetting: string;
  competitorTypes: string[];
  competitorsRunningAds: string;
  competitorsSocialActive: string;
  marketGaps: string[];
  competitorNames: string;
}

export interface OnlinePresenceAuditRow {
  asset: string;
  currentState: string;
  requiredFix: string;
  priority: "High" | "Medium" | "Low";
}

export interface CompetitorDeficitRow {
  competitorName: string;
  competitorCategory: string;
  theirStrength: string;
  digitalWeaknesses: string[];
  yourAdvantage: string;
}

export interface PricingComparisonRow {
  competitorName: string;
  serviceOrProcedure: string;
  competitorPriceNote: string;
  yourPriceNote: string;
  valueAngle: string;
}

export interface KeywordGeoRow {
  campaignTier: string;
  targetGeography: string;
  primaryKeywords: string[];
  searchIntent: string;
}

export interface CadenceChecklistItem {
  task: string;
  category: string;
}

export interface DiscoveryReport {
  capacityStrategy: string;
  uvpPositioning: string;
  reputationPlan: string;
  websitePriorities: string;
  onlinePresenceAudit: OnlinePresenceAuditRow[];
  competitorDeficitAnalysis: CompetitorDeficitRow[];
  pricingComparison: PricingComparisonRow[];
  keywordGeoMatrix: KeywordGeoRow[];
  monthlyChecklist: CadenceChecklistItem[];
  quarterlyChecklist: CadenceChecklistItem[];
}

export interface FullDiscoveryPlan {
  onboarding: OnboardingPlan;
  discovery: DiscoveryReport;
}
