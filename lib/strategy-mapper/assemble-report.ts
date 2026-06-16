import { getTierByKey, type ServiceTierTemplate, type TierPlaceholderContext } from "@/lib/strategy-mapper/tier-library";
import { buildActiveStrategyBlock, interpolateTierText } from "@/lib/strategy-mapper/tier-template-engine";
import {
  assembleExecutiveSummary,
  assembleKeywordMatrix,
  assembleLaunchRoadmap,
  resolveUpsellWhy,
  type ContentBlockTemplate,
  type ContentPlaceholderContext,
} from "@/lib/strategy-mapper/content-library";
import { applySiteScopeToReport } from "@/lib/strategy-mapper/site-scope-copy";
import type { DualRadiusResult } from "@/types/strategy-mapper";
import {
  applyPpcSelfManagedAuditTactics,
  PPC_INTRODUCTION_UPSELL_OBSERVATION,
} from "@/lib/strategy-mapper/ppc-tactic-resolver";
import type { UpsellTierCandidate } from "@/lib/strategy-mapper/tier-resolver";
import type { UpsellDirective } from "@/types/strategy-mapper";
import type {
  ActiveStrategyBlock,
  CompetitiveAuditRow,
  GrowthOpportunityBlock,
  StrategyMapperFormData,
  StrategyMapperReport,
  StrategyMapperResearch,
  StrategyMapperService,
  UpsellFraming,
} from "@/types/strategy-mapper";

export interface AssembledReportParts {
  activeStrategies: Partial<Record<StrategyMapperService, ActiveStrategyBlock>>;
  growthOpportunityStubs: GrowthOpportunityBlock[];
  competitiveAuditRows: CompetitiveAuditRow[];
  internalStrategistChecklist: string[];
}

export const STRATEGIST_CHECKLIST_ITEMS = [
  "Claiming and verifying Google Business Profile access for [Practice Name].",
  "Property mappings in Google Search Console and GA4 pixel staging.",
  "Baseline technical auditing via Google Lighthouse and Screaming Frog.",
  "Structuring localized keyword maps and building the client onboarding workspace.",
] as const;

export function assembleStrategistChecklist(ctx: TierPlaceholderContext): string[] {
  return STRATEGIST_CHECKLIST_ITEMS.map((item) => interpolateTierText(item, ctx));
}

function formatClientRunsGoogleAds(
  research: StrategyMapperResearch,
  form: StrategyMapperFormData,
  activeServices: StrategyMapperService[],
): string {
  const clientRunsOwnAds = form.salesPdfExtract?.clientRunsOwnAds === true;
  const ppcPurchased = activeServices.includes("ppc");

  if (clientRunsOwnAds) {
    if (ppcPurchased) {
      return research.clientMetrics.runsGoogleAds ? "Yes" : "Yes";
    }
    return "Yes (self-managed)";
  }

  return research.clientMetrics.runsGoogleAds ? "Yes" : "No";
}

export function assembleCompetitiveAuditRows(
  form: StrategyMapperFormData,
  research: StrategyMapperResearch,
  activeServices: StrategyMapperService[],
): CompetitiveAuditRow[] {
  const clientRow: CompetitiveAuditRow = {
    practiceName: form.practiceName,
    isClient: true,
    distance: "—",
    googleRating: String(research.clientMetrics.googleRating),
    reviewCount: String(research.clientMetrics.reviewCount),
    runsGoogleAds: formatClientRunsGoogleAds(research, form, activeServices),
  };

  const competitorRows: CompetitiveAuditRow[] = research.competitors.map((competitor) => ({
    practiceName: competitor.name,
    isClient: false,
    distance: `${competitor.distanceMiles} mi`,
    googleRating: String(competitor.googleRating),
    reviewCount: String(competitor.reviewCount),
    runsGoogleAds: competitor.runsGoogleAds ? "Yes" : "No",
  }));

  return [clientRow, ...competitorRows];
}

export function finalizeActiveStrategies(
  strategies: Partial<Record<StrategyMapperService, ActiveStrategyBlock>>,
  ctx: TierPlaceholderContext,
): Partial<Record<StrategyMapperService, ActiveStrategyBlock>> {
  if (!strategies.ppc || !ctx.form.salesPdfExtract?.clientRunsOwnAds) {
    return strategies;
  }

  return {
    ...strategies,
    ppc: applyPpcSelfManagedAuditTactics(strategies.ppc, ctx),
  };
}

export function assembleActiveStrategies(
  selectedTierKeys: Partial<Record<StrategyMapperService, string>>,
  tiers: ServiceTierTemplate[],
  ctx: TierPlaceholderContext,
): Partial<Record<StrategyMapperService, ActiveStrategyBlock>> {
  const result: Partial<Record<StrategyMapperService, ActiveStrategyBlock>> = {};

  for (const [service, tierKey] of Object.entries(selectedTierKeys) as Array<
    [StrategyMapperService, string]
  >) {
    const tier = getTierByKey(tiers, tierKey);
    if (!tier) continue;
    result[service] = buildActiveStrategyBlock(tier, ctx);
  }

  return result;
}

export function assembleGrowthOpportunityFromTier(
  tier: ServiceTierTemplate,
  ctx: TierPlaceholderContext,
  framing?: UpsellFraming,
): GrowthOpportunityBlock {
  if (tier.service === "ppc" && framing === "introduction") {
    return {
      service: tier.service,
      title: interpolateTierText(tier.title, ctx),
      marketObservation: interpolateTierText(PPC_INTRODUCTION_UPSELL_OBSERVATION, ctx),
      whyItMatters: "",
      framing,
    };
  }

  const objective = interpolateTierText(tier.objective, ctx);
  const tacticPreview = tier.tactics
    .slice(0, 2)
    .map((t) => interpolateTierText(t, ctx))
    .join(" ");

  return {
    service: tier.service,
    title: interpolateTierText(tier.title, ctx),
    marketObservation: `${objective}${tacticPreview ? ` ${tacticPreview}` : ""}`.trim(),
    whyItMatters: "",
    framing,
  };
}

export function assembleGrowthOpportunityStubs(
  candidates: UpsellTierCandidate[],
  tiers: ServiceTierTemplate[],
  ctx: TierPlaceholderContext,
): GrowthOpportunityBlock[] {
  return candidates
    .map((candidate) => {
      const tier = getTierByKey(tiers, candidate.tierKey);
      if (!tier) return null;
      return assembleGrowthOpportunityFromTier(tier, ctx, candidate.directive?.framing);
    })
    .filter((block): block is GrowthOpportunityBlock => block != null);
}

export type StrategyMapperPartialReport = Omit<
  StrategyMapperReport,
  "activeStrategies" | "competitiveAuditRows" | "internalStrategistChecklist"
> & {
  activeStrategies?: StrategyMapperReport["activeStrategies"];
  competitiveAuditRows?: StrategyMapperReport["competitiveAuditRows"];
  internalStrategistChecklist?: StrategyMapperReport["internalStrategistChecklist"];
};

export function mergeDeterministicReport(
  llmPartial: StrategyMapperPartialReport,
  assembled: AssembledReportParts,
): StrategyMapperReport {
  const growthByService = new Map(
    assembled.growthOpportunityStubs.map((stub) => [stub.service, stub] as const),
  );

  const growthOpportunities = llmPartial.growthOpportunities.map((llmBlock) => {
    const stub = growthByService.get(llmBlock.service);
    if (!stub) return llmBlock;
    return {
      ...stub,
      whyItMatters: llmBlock.whyItMatters || stub.whyItMatters,
      framing: llmBlock.framing ?? stub.framing,
    };
  });

  for (const stub of assembled.growthOpportunityStubs) {
    if (!growthOpportunities.some((b) => b.service === stub.service)) {
      growthOpportunities.push(stub);
    }
  }

  return {
    ...llmPartial,
    activeStrategies: assembled.activeStrategies,
    competitiveAuditRows: assembled.competitiveAuditRows,
    growthOpportunities,
    internalStrategistChecklist: assembled.internalStrategistChecklist,
  };
}

export interface AssembleFullReportInput {
  form: StrategyMapperFormData;
  research: StrategyMapperResearch;
  radius: DualRadiusResult;
  activeServices: StrategyMapperService[];
  selectedTierKeys: Partial<Record<StrategyMapperService, string>>;
  tiers: ServiceTierTemplate[];
  contentBlocks: ContentBlockTemplate[];
  upsellDirectives: UpsellDirective[];
  upsellTierCandidates: UpsellTierCandidate[];
}

/** Deterministic report assembly from tier + content libraries. AI can enhance sections later. */
export function assembleFullReport(input: AssembleFullReportInput): StrategyMapperReport {
  const {
    form,
    research,
    radius,
    activeServices,
    selectedTierKeys,
    tiers,
    contentBlocks,
    upsellTierCandidates,
  } = input;

  const tierContext: TierPlaceholderContext = { form, radius };
  const contentContext: ContentPlaceholderContext = {
    form,
    radius,
    research,
    activeServices,
  };

  const assembledActiveStrategies = finalizeActiveStrategies(
    assembleActiveStrategies(selectedTierKeys, tiers, tierContext),
    tierContext,
  );

  const growthOpportunityStubs = assembleGrowthOpportunityStubs(
    upsellTierCandidates,
    tiers,
    tierContext,
  );

  const growthOpportunities = growthOpportunityStubs.map((stub) => ({
    ...stub,
    whyItMatters:
      resolveUpsellWhy(contentBlocks, stub.service, stub.framing, contentContext) ||
      stub.whyItMatters,
  }));

  const report: StrategyMapperReport = {
    executiveSummary: assembleExecutiveSummary(contentBlocks, contentContext),
    seoKeywordMatrix: activeServices.includes("seo")
      ? assembleKeywordMatrix(contentBlocks, contentContext)
      : [],
    activeStrategies: assembledActiveStrategies,
    competitiveAuditRows: assembleCompetitiveAuditRows(form, research, activeServices),
    growthOpportunities,
    launchRoadmap: assembleLaunchRoadmap(contentBlocks, contentContext),
    internalStrategistChecklist: assembleStrategistChecklist(tierContext),
  };

  return applySiteScopeToReport(report, tierContext);
}
