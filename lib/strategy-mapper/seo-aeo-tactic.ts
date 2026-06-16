import type { DualRadiusResult, SiteContext, StrategyMapperFormData } from "@/types/strategy-mapper";
import { resolveSiteContext } from "@/lib/strategy-mapper/form-options";
import {
  STRATEGIC_ARCHITECT_PRELAUNCH,
  EXISTING_SITE_OPTIMIZATION,
} from "@/lib/strategy-mapper/site-scope-constants";

const AEO_TACTIC_MARKER = "AI Search & Answer Engine Optimization (AEO) Deployment";

export function buildSpecializationsForAeo(form: StrategyMapperFormData): string {
  const items = [...form.specializations];
  if (form.customSpecialization.trim()) {
    items.push(form.customSpecialization.trim());
  }
  for (const procedure of form.salesPdfExtract?.primaryProcedures ?? []) {
    if (!items.some((item) => item.toLowerCase().includes(procedure.toLowerCase()))) {
      items.push(procedure);
    }
  }
  return items.length > 0 ? items.join(", ") : "general veterinary care";
}

function aeoTail(form: StrategyMapperFormData, specializations: string, locationContext: string): string {
  return `This architecture strips away script and code clutter, formatting ${form.practiceName}'s core identifiers, specialized capabilities (such as ${specializations}), and credentials into a clean, high-density, machine-readable format. This ensures that modern AI search engines and LLM web crawlers (such as ChatGPT, Claude, Perplexity, and Apple Intelligence) can instantly index and accurately cite the practice as the premier recommendation for ${locationContext} pet parents.`;
}

export function buildMandatorySeoAeoTactic(
  form: StrategyMapperFormData,
  radius: DualRadiusResult,
  siteContext?: SiteContext,
): string {
  const context = siteContext ?? resolveSiteContext(form);
  const specializations = buildSpecializationsForAeo(form);
  const locationContext = radius.geographicFocusLabel || form.streetAddress;
  const tail = aeoTail(form, specializations, locationContext);

  if (context === "brand_new_ground_up") {
    return `${AEO_TACTIC_MARKER}: Build and embed token-optimized llms.txt and llms-full.txt files into the root directory of the new website. ${tail}`;
  }

  if (context === "existing_active") {
    return `${AEO_TACTIC_MARKER}: Deploy token-optimized llms.txt and llms-full.txt specifications and embed them into the accessible layers of your active web property. ${EXISTING_SITE_OPTIMIZATION} ${tail}`;
  }

  return `${AEO_TACTIC_MARKER}: ${STRATEGIC_ARCHITECT_PRELAUNCH} — architect llms.txt and llms-full.txt token-optimized file specifications for execution on the incoming platform. ${tail}`;
}

export function seoAeoTacticPromptBlock(
  form: StrategyMapperFormData,
  radius: DualRadiusResult,
): string {
  const example = buildMandatorySeoAeoTactic(form, radius);
  return `
SEO (Phase 1 — purchased) — MANDATORY AI/AEO TACTIC:
- activeStrategies.seo.tactics MUST include other SEO tactics first, then ALWAYS end with this EXACT final bullet (adapt only the bracketed specialization/location inserts — preserve phrasing and structure):
  * ${example}
- Do NOT omit this tactic. Do NOT paraphrase the opening label "${AEO_TACTIC_MARKER}."`;
}

export function ensureMandatorySeoAeoTactic(
  tactics: string[],
  mandatoryTactic: string,
): string[] {
  const hasAeo = tactics.some((t) => t.includes(AEO_TACTIC_MARKER));
  if (hasAeo) {
    const without = tactics.filter((t) => !t.includes(AEO_TACTIC_MARKER));
    return [...without, mandatoryTactic];
  }
  return [...tactics, mandatoryTactic];
}

export { AEO_TACTIC_MARKER };
