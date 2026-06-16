import type { ActiveStrategyBlock } from "@/types/strategy-mapper";
import type { TierPlaceholderContext } from "@/lib/strategy-mapper/tier-library";
import { interpolateTierText } from "@/lib/strategy-mapper/tier-template-engine";

const PPC_SELF_MANAGED_AUDIT_TACTICS = [
  "Full audit of existing Google Ads account structure, keyword targeting, and negative keyword lists to eliminate low-converting spend.",
  "Restructure campaigns to separate local urgent care and wellness intent from regional surgical intent, allowing tailored messaging and optimized geographic bid adjustments.",
  "Align paid search conversion tracking with [Practice Name] onboarding workspace baselines before scaling spend.",
];

export const PPC_INTRODUCTION_UPSELL_OBSERVATION =
  "Our competitive audit indicates that multiple local practices are actively running Google Ads to intercept high-intent queries. Unifying paid campaigns with your organic keyword data presents a massive efficiency gain.";

export function applyPpcSelfManagedAuditTactics(
  block: ActiveStrategyBlock,
  ctx: TierPlaceholderContext,
): ActiveStrategyBlock {
  return {
    ...block,
    tactics: PPC_SELF_MANAGED_AUDIT_TACTICS.map((tactic) =>
      interpolateTierText(tactic, ctx),
    ),
  };
}
