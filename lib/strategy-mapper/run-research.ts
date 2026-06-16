import type Anthropic from "@anthropic-ai/sdk";
import { VET_ONBOARDING_MODEL } from "@/lib/vet-onboarding/anthropic-model";
import { resolveActiveServices } from "@/lib/strategy-mapper/form-options";
import { parseResearchFromText } from "@/lib/strategy-mapper/parse-research-fallback";
import { buildStrategyMapperResearchPrompt } from "@/lib/strategy-mapper/prompts";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";
import { strategyMapperResearchOutputFormat } from "@/lib/strategy-mapper/research-json-schema";
import type {
  DualRadiusResult,
  StrategyMapperFormData,
  StrategyMapperResearch,
  StrategyMapperService,
} from "@/types/strategy-mapper";

export interface StrategyMapperResearchResult {
  research: StrategyMapperResearch;
  radius: DualRadiusResult;
  activeServices: StrategyMapperService[];
}

function extractCombinedText(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function resolveResearchFromMessage(
  researchMessage: Awaited<ReturnType<Anthropic["messages"]["parse"]>>,
): StrategyMapperResearch | null {
  if (researchMessage.parsed_output) {
    return researchMessage.parsed_output as StrategyMapperResearch;
  }

  const combinedText = extractCombinedText(researchMessage.content);
  if (!combinedText.trim()) return null;

  return parseResearchFromText(combinedText);
}

export async function runStrategyMapperResearch(
  anthropic: Anthropic,
  form: StrategyMapperFormData,
): Promise<StrategyMapperResearchResult> {
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

  const researchMessage = await anthropic.messages.parse({
    model: VET_ONBOARDING_MODEL,
    max_tokens: 12288,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: buildStrategyMapperResearchPrompt(form, radius, activeServices),
      },
    ],
    output_config: { format: strategyMapperResearchOutputFormat },
  });

  const research = resolveResearchFromMessage(researchMessage);
  if (!research) {
    const combinedText = extractCombinedText(researchMessage.content);
    throw new Error(
      `Research step returned no structured output (stop_reason=${researchMessage.stop_reason}, text_blocks=${researchMessage.content.filter((b) => b.type === "text").length}, text_length=${combinedText.length})`,
    );
  }

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

  research.densityTier = radius.densityTier;
  research.wellnessRadiusMiles = radius.wellnessRadiusMiles;
  research.specialtyRadiusMiles = radius.specialtyRadiusMiles;
  research.specialtyRadiusEnabled = radius.specialtyRadiusEnabled;
  research.radiusRationale = radius.rationale;

  return { research, radius, activeServices };
}
