import { resolveActiveServices } from "@/lib/strategy-mapper/form-options";
import type { StrategyMapperResearchResult } from "@/lib/strategy-mapper/run-research";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";
import type { StrategyMapperFormData, StrategyMapperResearch } from "@/types/strategy-mapper";

export const STRATEGY_MAPPER_MOCK_RESEARCH_STORAGE_KEY =
  "strategy-mapper-use-mock-research";

export function isStrategyMapperMockResearchEnabled(): boolean {
  return process.env.STRATEGY_MAPPER_MOCK_RESEARCH === "true";
}

export function shouldUseMockStrategyMapperResearch(requested?: boolean): boolean {
  return isStrategyMapperMockResearchEnabled() || requested === true;
}

export function isAnthropicUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("credit balance") ||
    message.includes("too low to access the anthropic api") ||
    message.includes("anthropic api") && message.includes("billing")
  );
}

export function buildMockPreCheckResult(
  form: StrategyMapperFormData,
  options?: { mockFallbackReason?: string },
): StrategyMapperResearchResult & {
  mockMode: true;
  mockFallbackReason?: string;
} {
  const result = buildMockStrategyMapperResearch(form);
  return {
    ...result,
    mockMode: true,
    mockFallbackReason: options?.mockFallbackReason,
  };
}

function defaultMockCompetitors(): StrategyMapperResearch["competitors"] {
  return [
    {
      name: "Nearby Veterinary Hospital",
      distanceMiles: 3.4,
      googleRating: 4.5,
      reviewCount: 312,
      runsGoogleAds: true,
      scope: "local",
    },
    {
      name: "Community Animal Clinic",
      distanceMiles: 6.8,
      googleRating: 4.2,
      reviewCount: 148,
      runsGoogleAds: false,
      scope: "local",
    },
    {
      name: "Regional Veterinary Specialists",
      distanceMiles: 14.2,
      googleRating: 4.7,
      reviewCount: 620,
      runsGoogleAds: true,
      scope: "regional",
    },
  ];
}

function applyFormMetricOverrides(
  research: StrategyMapperResearch,
  form: StrategyMapperFormData,
): void {
  if (form.clientGoogleRating?.trim()) {
    const rating = parseFloat(form.clientGoogleRating.replace(/[^\d.]/g, ""));
    if (Number.isFinite(rating)) {
      research.clientMetrics.googleRating = rating;
    }
  }
  if (form.clientReviewCount?.trim()) {
    const count = parseInt(form.clientReviewCount.replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(count)) {
      research.clientMetrics.reviewCount = count;
    }
  }
  if (form.salesPdfExtract?.clientRunsOwnAds) {
    research.clientMetrics.runsGoogleAds = true;
  }
}

export function buildMockStrategyMapperResearch(
  form: StrategyMapperFormData,
): StrategyMapperResearchResult {
  const activeServices = resolveActiveServices(
    form.activeServices ?? [],
    form.salesPdfExtract?.purchasedServices,
  );

  if (!activeServices.length) {
    throw new Error(
      "No active Phase 1 services — select services on the form or include them in the sales PDF purchased products table.",
    );
  }

  const radius = calculateDualRadius(form);

  const research: StrategyMapperResearch = {
    densityTier: radius.densityTier,
    wellnessRadiusMiles: radius.wellnessRadiusMiles,
    specialtyRadiusMiles: radius.specialtyRadiusMiles,
    specialtyRadiusEnabled: radius.specialtyRadiusEnabled,
    radiusRationale: radius.rationale,
    clientMetrics: {
      googleRating: 4.0,
      reviewCount: 50,
      runsGoogleAds: false,
    },
    competitors: defaultMockCompetitors(),
  };

  applyFormMetricOverrides(research, form);

  return { research, radius, activeServices };
}
