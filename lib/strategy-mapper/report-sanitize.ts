import type {
  DualRadiusResult,
  GrowthOpportunityBlock,
  SalesPdfExtract,
  StrategyMapperFormData,
  StrategyMapperReport,
  StrategyMapperService,
} from "@/types/strategy-mapper";
import type { AssembledReportParts } from "@/lib/strategy-mapper/assemble-report";

export function stripMissionLabelPrefix(text: string): string {
  let result = text.trim();
  while (/^Our Shared Mission:\s*/i.test(result)) {
    result = result.replace(/^Our Shared Mission:\s*/i, "").trim();
  }
  return result;
}

export function stripPainPointLabelPrefix(text: string): string {
  let result = text.trim();
  while (/^Direct Pain-Point Resolution:\s*/i.test(result)) {
    result = result.replace(/^Direct Pain-Point Resolution:\s*/i, "").trim();
  }
  return result;
}

export function sanitizeReport(
  report: StrategyMapperReport,
  activeServices: StrategyMapperService[],
  allowedUpsellServices: StrategyMapperService[],
  salesExtract?: SalesPdfExtract,
  assembled?: AssembledReportParts,
): StrategyMapperReport {
  const allowedSet = new Set(
    allowedUpsellServices.filter((service) => !activeServices.includes(service)),
  );
  const activeSet = new Set(activeServices);

  const stubByService = new Map(
    (assembled?.growthOpportunityStubs ?? []).map((stub) => [stub.service, stub] as const),
  );

  const growthOpportunities = report.growthOpportunities
    .filter((block) => allowedSet.has(block.service) && !activeSet.has(block.service))
    .map((block) => {
      const stub = stubByService.get(block.service);
      if (!stub) return block;
      return {
        ...block,
        title: stub.title,
        marketObservation: stub.marketObservation,
        framing: block.framing ?? stub.framing,
      };
    });

  const activeStrategies =
    assembled?.activeStrategies ??
    (Object.fromEntries(
      Object.entries(report.activeStrategies).filter(([key]) =>
        activeSet.has(key as StrategyMapperService),
      ),
    ) as StrategyMapperReport["activeStrategies"]);

  const seoKeywordMatrix = activeSet.has("seo") ? report.seoKeywordMatrix : [];

  const executiveSummary = {
    ...report.executiveSummary,
    missionStatement: stripMissionLabelPrefix(
      report.executiveSummary.missionStatement,
    ),
    painPointResolution: stripPainPointLabelPrefix(
      report.executiveSummary.painPointResolution,
    ),
  };

  return {
    ...report,
    executiveSummary,
    growthOpportunities,
    activeStrategies,
    seoKeywordMatrix,
    internalStrategistChecklist: report.internalStrategistChecklist ?? [],
  };
}

export function preserveGrowthStubText(
  llmBlock: GrowthOpportunityBlock,
  stub: GrowthOpportunityBlock,
): GrowthOpportunityBlock {
  return {
    ...llmBlock,
    title: stub.title,
    marketObservation: stub.marketObservation,
    framing: llmBlock.framing ?? stub.framing,
  };
}
