import type { SupabaseClient } from "@supabase/supabase-js";
import { interpolateTierText } from "@/lib/strategy-mapper/tier-template-engine";
import type { TierPlaceholderContext } from "@/lib/strategy-mapper/tier-library";
import type {
  KeywordMatrixRow,
  LaunchRoadmapStep,
  PrimaryBusinessGoal,
  StrategyMapperResearch,
  StrategyMapperService,
  UpsellFraming,
} from "@/types/strategy-mapper";

export type ContentBlockCategory = "executive" | "keyword_row" | "launch_step" | "upsell_why";

export interface ExecutivePayload {
  missionStatement: string;
  narrative: string;
  painPointResolution: string;
  coreFocusAreas: string[];
}

export interface KeywordRowPayload {
  intentCategory: string;
  targetGeography: string;
  keywordVariations: string[];
}

export interface LaunchStepPayload {
  stepNumber: number;
  title: string;
  description: string;
}

export interface UpsellWhyPayload {
  whyItMatters: string;
}

export type ContentBlockPayload =
  | ExecutivePayload
  | KeywordRowPayload
  | LaunchStepPayload
  | UpsellWhyPayload;

export interface ContentBlockTemplate {
  id?: number;
  blockKey: string;
  category: ContentBlockCategory;
  primaryGoal?: PrimaryBusinessGoal | null;
  service?: StrategyMapperService | null;
  framing?: UpsellFraming | null;
  sortOrder: number;
  payload: ContentBlockPayload;
  enabled: boolean;
}

type DbContentRow = {
  id: number;
  block_key: string;
  category: ContentBlockCategory;
  primary_goal: PrimaryBusinessGoal | null;
  service: StrategyMapperService | null;
  framing: UpsellFraming | null;
  sort_order: number;
  payload: ContentBlockPayload;
  enabled: boolean;
};

export interface ContentPlaceholderContext extends TierPlaceholderContext {
  research: StrategyMapperResearch;
  activeServices: StrategyMapperService[];
}

function rowToTemplate(row: DbContentRow): ContentBlockTemplate {
  return {
    id: row.id,
    blockKey: row.block_key,
    category: row.category,
    primaryGoal: row.primary_goal,
    service: row.service,
    framing: row.framing,
    sortOrder: row.sort_order,
    payload: row.payload,
    enabled: row.enabled,
  };
}

function topCompetitor(research: StrategyMapperResearch) {
  return research.competitors[0];
}

function reviewGap(research: StrategyMapperResearch): number {
  const top = topCompetitor(research);
  if (!top) return 0;
  return Math.max(0, top.reviewCount - research.clientMetrics.reviewCount);
}

function formatSpecialty(ctx: ContentPlaceholderContext): string {
  const items = [...ctx.form.specializations];
  if (ctx.form.customSpecialization.trim()) {
    items.push(ctx.form.customSpecialization.trim());
  }
  return items.length > 0 ? items.join(", ") : "veterinary";
}

function formatActiveServices(ctx: ContentPlaceholderContext): string {
  return ctx.activeServices.join(", ") || "Phase 1 services";
}

const CONTENT_PLACEHOLDER_MAP: Record<string, (ctx: ContentPlaceholderContext) => string> = {
  "[Primary Goal]": (ctx) => ctx.form.primaryGoal || "local growth",
  "[Specialty]": formatSpecialty,
  "[Wellness Radius]": (ctx) => String(ctx.radius.wellnessRadiusMiles),
  "[Active Services]": formatActiveServices,
  "[Top Competitor]": (ctx) => topCompetitor(ctx.research)?.name ?? "local competitors",
  "[Top Competitor Reviews]": (ctx) =>
    String(topCompetitor(ctx.research)?.reviewCount ?? "—"),
  "[Client Reviews]": (ctx) => String(ctx.research.clientMetrics.reviewCount),
  "[Review Gap]": (ctx) => String(reviewGap(ctx.research)),
  "[Pain Points]": (ctx) =>
    ctx.form.salesPdfExtract?.painPoints.join("; ") ||
    ctx.form.strategicContextNotes ||
    "documented intake pain points",
  "[Clinical Differentiator]": (ctx) =>
    ctx.form.salesPdfExtract?.clinicalDifferentiator.trim() || "clinical differentiators from intake",
};

export function interpolateContentText(text: string, ctx: ContentPlaceholderContext): string {
  let result = interpolateTierText(text, ctx);
  for (const [placeholder, resolver] of Object.entries(CONTENT_PLACEHOLDER_MAP)) {
    result = result.split(placeholder).join(resolver(ctx));
  }
  return result;
}

export const DEFAULT_CONTENT_FALLBACKS: ContentBlockTemplate[] = [
  {
    blockKey: "executive-fallback",
    category: "executive",
    primaryGoal: null,
    sortOrder: 99,
    enabled: true,
    payload: {
      missionStatement:
        "Grow [Practice Name]'s local visibility and new-client pipeline across [City] with a data-backed Phase 1 marketing foundation.",
      narrative:
        "This plan assembles tier-library Phase 1 tactics, verified competitive benchmarks, and strategist checklist items into a single onboarding-ready document.",
      painPointResolution:
        "We will address [Pain Points] with accountable execution and measurable progress checkpoints.",
      coreFocusAreas: [
        "Local search visibility within [Local Core Radius]",
        "Competitive positioning vs [Top Competitor]",
        "Phase 1 service alignment to [Primary Goal]",
        "Onboarding workspace and asset collection",
      ],
    },
  },
  {
    blockKey: "keyword-local-wellness",
    category: "keyword_row",
    sortOrder: 1,
    enabled: true,
    payload: {
      intentCategory: "Local Core (General Wellness)",
      targetGeography: "[City] ([Wellness Radius] mi)",
      keywordVariations: ["vet near me", "animal hospital [City]", "veterinarian [City]"],
    },
  },
  {
    blockKey: "keyword-specialty-regional",
    category: "keyword_row",
    sortOrder: 2,
    enabled: true,
    payload: {
      intentCategory: "High-Intent Specialty (Regional)",
      targetGeography: "[Practice Location] ([Regional Radius])",
      keywordVariations: [
        "[Specialty] vet near me",
        "veterinary [Specialty] [City]",
        "affordable [Specialty] veterinarian",
      ],
    },
  },
  {
    blockKey: "launch-step-1",
    category: "launch_step",
    sortOrder: 1,
    enabled: true,
    payload: {
      stepNumber: 1,
      title: "Kickoff Meeting",
      description:
        "Align on [Primary Goal], Phase 1 services ([Active Services]), and onboarding milestones for [Practice Name].",
    },
  },
  {
    blockKey: "launch-step-2",
    category: "launch_step",
    sortOrder: 2,
    enabled: true,
    payload: {
      stepNumber: 2,
      title: "Technical Asset Gathering",
      description:
        "Collect GBP admin, analytics access, platform credentials, and creative assets for [Practice Name].",
    },
  },
  {
    blockKey: "launch-step-3",
    category: "launch_step",
    sortOrder: 3,
    enabled: true,
    payload: {
      stepNumber: 3,
      title: "Strategy Launch Day",
      description:
        "Publish tier-library Phase 1 tactics, activate keyword matrix targets, and schedule the first 30-day optimization checkpoint.",
    },
  },
  {
    blockKey: "upsell-orm-reputation_gap",
    category: "upsell_why",
    service: "orm",
    framing: "reputation_gap",
    sortOrder: 1,
    enabled: true,
    payload: {
      whyItMatters:
        "Closing the [Review Gap]-review gap vs [Top Competitor] is the fastest lever to improve local conversion rates without increasing ad spend.",
    },
  },
  {
    blockKey: "upsell-ppc-introduction",
    category: "upsell_why",
    service: "ppc",
    framing: "introduction",
    sortOrder: 2,
    enabled: true,
    payload: {
      whyItMatters:
        "Local competitors including [Top Competitor] are capturing high-intent clicks on Google — structured PPC management closes that demand leak for [Practice Name].",
    },
  },
  {
    blockKey: "upsell-ppc-optimization",
    category: "upsell_why",
    service: "ppc",
    framing: "optimization",
    sortOrder: 3,
    enabled: true,
    payload: {
      whyItMatters:
        "Self-managed ads can be refined with professional structure and landing-page alignment to lower cost per new client for [Practice Name].",
    },
  },
  {
    blockKey: "upsell-social-community",
    category: "upsell_why",
    service: "social",
    framing: "community",
    sortOrder: 4,
    enabled: true,
    payload: {
      whyItMatters:
        "Regional pet parents researching providers increasingly validate trust through social proof — a structured content program pre-sells complex stays before the first phone call.",
    },
  },
];

export function sortContentBlocks(blocks: ContentBlockTemplate[]): ContentBlockTemplate[] {
  return [...blocks].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.sortOrder - b.sortOrder;
  });
}

export async function fetchContentBlocks(
  supabase: SupabaseClient,
): Promise<ContentBlockTemplate[]> {
  const { data, error } = await supabase
    .from("strategy_mapper_content_blocks")
    .select("*")
    .order("category")
    .order("sort_order");

  if (error || !data?.length) {
    return sortContentBlocks(DEFAULT_CONTENT_FALLBACKS);
  }

  return sortContentBlocks(data.map((row) => rowToTemplate(row as DbContentRow)));
}

export function getExecutiveTemplate(
  blocks: ContentBlockTemplate[],
  goal: PrimaryBusinessGoal | "",
): ExecutivePayload {
  const match =
    goal !== ""
      ? blocks.find(
          (b) =>
            b.enabled &&
            b.category === "executive" &&
            b.primaryGoal === goal,
        )
      : undefined;
  const resolved =
    match ??
    blocks.find(
      (b) => b.enabled && b.category === "executive" && b.blockKey === "executive-fallback",
    ) ??
    DEFAULT_CONTENT_FALLBACKS.find((b) => b.blockKey === "executive-fallback");

  return resolved!.payload as ExecutivePayload;
}

export function getKeywordRowTemplates(blocks: ContentBlockTemplate[]): KeywordRowPayload[] {
  return blocks
    .filter((b) => b.enabled && b.category === "keyword_row")
    .map((b) => b.payload as KeywordRowPayload);
}

export function getLaunchStepTemplates(blocks: ContentBlockTemplate[]): LaunchStepPayload[] {
  return blocks
    .filter((b) => b.enabled && b.category === "launch_step")
    .map((b) => b.payload as LaunchStepPayload);
}

export function getUpsellWhyTemplate(
  blocks: ContentBlockTemplate[],
  service: StrategyMapperService,
  framing?: UpsellFraming,
): string {
  const match =
    blocks.find(
      (b) =>
        b.enabled &&
        b.category === "upsell_why" &&
        b.service === service &&
        (framing ? b.framing === framing : true),
    ) ??
    blocks.find(
      (b) => b.enabled && b.category === "upsell_why" && b.service === service,
    );

  const payload = match?.payload as UpsellWhyPayload | undefined;
  return payload?.whyItMatters ?? "";
}

export function assembleExecutiveSummary(
  blocks: ContentBlockTemplate[],
  ctx: ContentPlaceholderContext,
): StrategyMapperReportExecutiveSummary {
  const template = getExecutiveTemplate(blocks, ctx.form.primaryGoal);
  return {
    missionStatement: interpolateContentText(template.missionStatement, ctx),
    narrative: interpolateContentText(template.narrative, ctx),
    painPointResolution: interpolateContentText(template.painPointResolution, ctx),
    coreFocusAreas: template.coreFocusAreas.map((area) =>
      interpolateContentText(area, ctx),
    ),
  };
}

export function assembleKeywordMatrix(
  blocks: ContentBlockTemplate[],
  ctx: ContentPlaceholderContext,
): KeywordMatrixRow[] {
  return getKeywordRowTemplates(blocks).map((row) => ({
    intentCategory: interpolateContentText(row.intentCategory, ctx),
    targetGeography: interpolateContentText(row.targetGeography, ctx),
    keywordVariations: row.keywordVariations.map((kw) =>
      interpolateContentText(kw, ctx),
    ),
  }));
}

export function assembleLaunchRoadmap(
  blocks: ContentBlockTemplate[],
  ctx: ContentPlaceholderContext,
): LaunchRoadmapStep[] {
  return getLaunchStepTemplates(blocks).map((step) => ({
    stepNumber: step.stepNumber,
    title: interpolateContentText(step.title, ctx),
    description: interpolateContentText(step.description, ctx),
  }));
}

export function resolveUpsellWhy(
  blocks: ContentBlockTemplate[],
  service: StrategyMapperService,
  framing: UpsellFraming | undefined,
  ctx: ContentPlaceholderContext,
): string {
  const template = getUpsellWhyTemplate(blocks, service, framing);
  if (!template.trim()) return "";
  return interpolateContentText(template, ctx);
}

type StrategyMapperReportExecutiveSummary = {
  missionStatement: string;
  narrative: string;
  painPointResolution: string;
  coreFocusAreas: string[];
};

export function templateToDbRow(
  block: ContentBlockTemplate,
): Omit<DbContentRow, "id"> {
  return {
    block_key: block.blockKey,
    category: block.category,
    primary_goal: block.primaryGoal ?? null,
    service: block.service ?? null,
    framing: block.framing ?? null,
    sort_order: block.sortOrder,
    payload: block.payload,
    enabled: block.enabled,
  };
}
