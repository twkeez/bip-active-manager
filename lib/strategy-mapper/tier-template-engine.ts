import type { ActiveStrategyBlock } from "@/types/strategy-mapper";
import type { ServiceTierTemplate, TierPlaceholderContext } from "@/lib/strategy-mapper/tier-library";

function parseCityFromAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const cityPart = parts[parts.length - 2] ?? parts[1];
    return cityPart.replace(/\d{5}(-\d{4})?/, "").trim();
  }
  return address.trim();
}

function formatPracticeType(ctx: TierPlaceholderContext): string {
  const items = [...ctx.form.specializations];
  if (ctx.form.customSpecialization.trim()) {
    items.push(ctx.form.customSpecialization.trim());
  }
  return items.length > 0 ? items.join(", ") : "veterinary";
}

function formatLocalRadius(ctx: TierPlaceholderContext): string {
  return `${ctx.radius.wellnessRadiusMiles}-mile radius`;
}

function formatRegionalRadius(ctx: TierPlaceholderContext): string {
  if (ctx.radius.specialtyRadiusEnabled && ctx.radius.specialtyRadiusMiles) {
    return `${ctx.radius.specialtyRadiusMiles}-mile radius`;
  }
  return "50-mile radius";
}

const PLACEHOLDER_MAP: Record<string, (ctx: TierPlaceholderContext) => string> = {
  "[Practice Name]": (ctx) => ctx.form.practiceName,
  "[Practice Type]": formatPracticeType,
  "[Practice Location]": (ctx) =>
    ctx.radius.geographicFocusLabel || parseCityFromAddress(ctx.form.streetAddress),
  "[Location Core]": (ctx) =>
    ctx.radius.geographicFocusLabel || parseCityFromAddress(ctx.form.streetAddress),
  "[City]": (ctx) => parseCityFromAddress(ctx.form.streetAddress),
  "[Local Core Radius]": formatLocalRadius,
  "[Regional Radius]": formatRegionalRadius,
};

export function interpolateTierText(text: string, ctx: TierPlaceholderContext): string {
  let result = text;
  for (const [placeholder, resolver] of Object.entries(PLACEHOLDER_MAP)) {
    result = result.split(placeholder).join(resolver(ctx));
  }
  return result;
}

export function buildActiveStrategyBlock(
  tier: ServiceTierTemplate,
  ctx: TierPlaceholderContext,
): ActiveStrategyBlock {
  return {
    title: interpolateTierText(tier.title, ctx),
    objective: interpolateTierText(tier.objective, ctx),
    tactics: tier.tactics.map((tactic) => interpolateTierText(tactic, ctx)),
  };
}

export function hasUnreplacedPlaceholders(text: string): boolean {
  return /\[[A-Za-z ]+\]/.test(text);
}
