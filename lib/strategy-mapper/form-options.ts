import type {
  PrimaryBusinessGoal,
  SalesPdfExtract,
  SiteContext,
  StrategyMapperFormData,
  StrategyMapperService,
} from "@/types/strategy-mapper";

export const SPECIALIZATION_OPTIONS = [
  "Small Animal",
  "Exotic / Avian",
  "Equine / Large Animal",
  "24/7 Emergency",
  "Urgent Care",
  "Surgical & Diagnostics",
  "Orthopedics / Specialty",
] as const;

export const HIGH_TICKET_SPECIALIZATION_SIGNALS = [
  "Orthopedics / Specialty",
  "Surgical & Diagnostics",
  "24/7 Emergency",
  "Urgent Care",
] as const;

export const CORE_SERVICE_OPTIONS = [
  { id: "seo" as const, label: "Search Engine Optimization (SEO)" },
  { id: "ppc" as const, label: "Pay-Per-Click Advertising (PPC)" },
  { id: "orm" as const, label: "Online Reputation/Review Management (ORM)" },
  { id: "social" as const, label: "Social Media Marketing & Management" },
];

export const SITE_CONTEXT_OPTIONS: Array<{ id: SiteContext; label: string }> = [
  { id: "existing_active", label: "Existing active website" },
  {
    id: "launching_external_builder",
    label: "Launching new site (external builder)",
  },
  {
    id: "replacement_build_in_progress",
    label: "Existing site today, new site in progress",
  },
  { id: "brand_new_ground_up", label: "Brand new ground-up clinic" },
];

export const DEFAULT_SITE_CONTEXT: SiteContext = "existing_active";

export const PRIMARY_GOAL_OPTIONS: PrimaryBusinessGoal[] = [
  "Fill a new associate veterinarian's calendar",
  "Increase high-ticket dental, surgical, or therapeutic procedures",
  "Reputation management/Repair negative search presence",
  "General new client acquisition / Market dominance",
];

export const INITIAL_SALES_CONTEXT: SalesPdfExtract = {
  summary: "",
  painPoints: [],
  goals: [],
  agencyFrustrations: [],
  purchasedServices: [],
  purchasedProductLabels: [],
  clinicalDifferentiator: "",
  primaryProcedures: [],
  clientRunsOwnAds: false,
  adsPerformanceNote: "",
  vendorPlatforms: [],
  ormProgramName: "",
  socialContentThemes: [],
  primarySocialPlatform: "",
  socialAdsHistory: "",
  operationalBottlenecks: [],
  capacityNotes: "",
  vendorFrustrations: [],
  staffConstraints: "",
  doctorCount: "",
  clientPersonaTone: "standard",
};

export const INITIAL_STRATEGY_MAPPER_FORM = {
  practiceName: "",
  practiceOwnerName: "",
  streetAddress: "",
  locationNotes: "",
  specializations: [] as string[],
  customSpecialization: "",
  activeServices: [] as StrategyMapperService[],
  primaryGoal: "" as PrimaryBusinessGoal | "",
  siteContext: DEFAULT_SITE_CONTEXT,
  strategicContextNotes: "",
  clientGoogleRating: "",
  clientReviewCount: "",
};

export function resolveSiteContext(form: StrategyMapperFormData): SiteContext {
  return form.siteContext ?? DEFAULT_SITE_CONTEXT;
}

export function ensureSalesContext(form: StrategyMapperFormData): StrategyMapperFormData {
  return {
    ...form,
    salesPdfExtract: form.salesPdfExtract ?? { ...INITIAL_SALES_CONTEXT },
  };
}

export const SERVICE_LABELS: Record<StrategyMapperService, string> = {
  seo: "Search Engine Optimization (SEO)",
  ppc: "Pay-Per-Click Advertising (PPC)",
  orm: "Online Reputation/Review Management (ORM)",
  social: "Social Media Marketing & Management",
};

export const ALL_SERVICES: StrategyMapperService[] = ["seo", "ppc", "orm", "social"];

/** Map PDF product names to internal service ids */
export function mapPurchasedProductToService(text: string): StrategyMapperService | null {
  const lower = text.toLowerCase();
  if (lower.includes("seo") || lower.includes("search engine")) return "seo";
  if (lower.includes("ppc") || lower.includes("pay-per-click") || lower.includes("google ads"))
    return "ppc";
  if (
    lower.includes("orm") ||
    lower.includes("reputation") ||
    lower.includes("review management")
  )
    return "orm";
  if (lower.includes("social")) return "social";
  return null;
}

export function resolveActiveServices(
  formActive: StrategyMapperService[],
  _pdfPurchased?: StrategyMapperService[],
): StrategyMapperService[] {
  return formActive;
}

export function normalizeWebsiteUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("://")) return value;
  return `https://${value}`;
}

export function websiteUrlRequiredForSiteContext(ctx: SiteContext): boolean {
  return ctx === "existing_active" || ctx === "replacement_build_in_progress";
}
