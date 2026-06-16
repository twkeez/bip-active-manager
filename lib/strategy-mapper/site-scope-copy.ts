import {
  AEO_TACTIC_MARKER,
  buildMandatorySeoAeoTactic,
} from "@/lib/strategy-mapper/seo-aeo-tactic";
import {
  STRATEGIC_ARCHITECT_SEO_BLUEPRINT,
  STRATEGIC_ARCHITECT_PRELAUNCH,
  EXISTING_SITE_OPTIMIZATION,
} from "@/lib/strategy-mapper/site-scope-constants";
import type { TierPlaceholderContext } from "@/lib/strategy-mapper/tier-library";
import { interpolateTierText } from "@/lib/strategy-mapper/tier-template-engine";
import { resolveSiteContext } from "@/lib/strategy-mapper/form-options";
import type {
  ActiveStrategyBlock,
  LaunchRoadmapStep,
  KeywordMatrixRow,
  SiteContext,
  StrategyMapperReport,
  StrategyMapperService,
} from "@/types/strategy-mapper";

export {
  STRATEGIC_ARCHITECT_SEO_BLUEPRINT,
  STRATEGIC_ARCHITECT_PRELAUNCH,
  EXISTING_SITE_OPTIMIZATION,
} from "@/lib/strategy-mapper/site-scope-constants";

const LANDING_PAGE_ECOSYSTEM_PREFIX = "Specialized Landing Page Ecosystem:";
const ON_PAGE_KEYWORD_PREFIX = "On-Page Keyword Mapping:";
const CONVERSION_ASSET_PREFIX = "Conversion Asset Deployment:";

function isStrategicArchitectContext(siteContext: SiteContext): boolean {
  return (
    siteContext === "launching_external_builder" ||
    siteContext === "replacement_build_in_progress"
  );
}

function applySiteScopeToTactic(tactic: string, ctx: TierPlaceholderContext): string {
  const siteContext = resolveSiteContext(ctx.form);

  if (siteContext === "brand_new_ground_up") {
    return tactic;
  }

  if (tactic.includes(AEO_TACTIC_MARKER)) {
    return buildMandatorySeoAeoTactic(ctx.form, ctx.radius, siteContext);
  }

  if (tactic.startsWith(LANDING_PAGE_ECOSYSTEM_PREFIX)) {
    if (siteContext === "existing_active") {
      return `Specialized Service Page Optimization: ${EXISTING_SITE_OPTIMIZATION} — engineered to rank for regional clinical keywords and capture high-margin cases outside your immediate neighborhood.`;
    }
    if (isStrategicArchitectContext(siteContext)) {
      return `Specialized Landing Page Blueprint: ${STRATEGIC_ARCHITECT_SEO_BLUEPRINT} — engineered to rank for regional clinical keywords (e.g., advanced surgeries, diagnostics, specific therapies), capturing high-margin cases outside your immediate neighborhood.`;
    }
  }

  if (tactic.startsWith(ON_PAGE_KEYWORD_PREFIX)) {
    if (siteContext === "existing_active") {
      return `On-Page Keyword Mapping: ${EXISTING_SITE_OPTIMIZATION} — geo-targeted title tags, header hierarchies, and meta descriptions mapped to [Practice Type] keywords on your active web property.`.replace(
        "[Practice Type]",
        interpolateTierText("[Practice Type]", ctx),
      );
    }
    if (isStrategicArchitectContext(siteContext)) {
      return `On-Page Keyword Mapping: ${STRATEGIC_ARCHITECT_SEO_BLUEPRINT} — mapped to [Practice Type] keywords for the incoming platform.`.replace(
        "[Practice Type]",
        interpolateTierText("[Practice Type]", ctx),
      );
    }
  }

  if (tactic.startsWith(CONVERSION_ASSET_PREFIX)) {
    if (siteContext === "existing_active") {
      return `${CONVERSION_ASSET_PREFIX} Direct paid traffic to optimized destinations on your active web property — single-action call extensions and form fillouts aligned to high-intent conversion architecture.`;
    }
    if (isStrategicArchitectContext(siteContext)) {
      return `Conversion Blueprint Deployment: Architect conversion-optimized keyword mapping layouts and paid-traffic destination specifications for execution — single-action call extensions and form fillouts designed to maximize new client conversion at launch.`;
    }
  }

  return tactic;
}

export function applySiteScopeToActiveStrategies(
  strategies: Partial<Record<StrategyMapperService, ActiveStrategyBlock>>,
  ctx: TierPlaceholderContext,
): Partial<Record<StrategyMapperService, ActiveStrategyBlock>> {
  const siteContext = resolveSiteContext(ctx.form);
  if (siteContext === "brand_new_ground_up") {
    return strategies;
  }

  const result: Partial<Record<StrategyMapperService, ActiveStrategyBlock>> = {};

  for (const [service, block] of Object.entries(strategies) as Array<
    [StrategyMapperService, ActiveStrategyBlock]
  >) {
    result[service] = {
      ...block,
      tactics: block.tactics.map((tactic) => applySiteScopeToTactic(tactic, ctx)),
    };
  }

  return result;
}

function pivotExecutiveText(text: string, siteContext: SiteContext): string {
  if (siteContext === "brand_new_ground_up") {
    return text;
  }

  let result = text;

  if (siteContext === "existing_active") {
    result = result.replace(
      /\bRegional landing pages\b/gi,
      "Regional service page optimization on your active web property",
    );
    result = result.replace(
      /\blanding pages\b/gi,
      "conversion-optimized page architecture on your active web property",
    );
    result = result.replace(
      /\bunresponsive web admin(?:istration)?\b/gi,
      "unresponsive web administration on your active property",
    );
    if (/web admin|website updates|CMS/i.test(result) && !result.includes(EXISTING_SITE_OPTIMIZATION.slice(0, 40))) {
      result = `${result} Our marketing team will ${EXISTING_SITE_OPTIMIZATION.charAt(0).toLowerCase()}${EXISTING_SITE_OPTIMIZATION.slice(1)}`;
    }
  }

  if (isStrategicArchitectContext(siteContext)) {
    result = result.replace(
      /\bRegional landing pages\b/gi,
      "Regional SEO page blueprints and URL hierarchies",
    );
    result = result.replace(
      /\blanding pages\b/gi,
      "technical SEO page blueprints",
    );
    result = result.replace(
      /\bbuilding (?:a )?new site\b/gi,
      "preparing the digital blueprint for the incoming platform",
    );
    if (/launch|new site|platform/i.test(result) && !result.includes(STRATEGIC_ARCHITECT_PRELAUNCH.slice(0, 30))) {
      result = `${result} ${STRATEGIC_ARCHITECT_PRELAUNCH}`;
    }
  }

  return result;
}

export function applySiteScopeToExecutiveSummary(
  summary: StrategyMapperReport["executiveSummary"],
  ctx: TierPlaceholderContext,
): StrategyMapperReport["executiveSummary"] {
  const siteContext = resolveSiteContext(ctx.form);
  if (siteContext === "brand_new_ground_up") {
    return summary;
  }

  return {
    missionStatement: pivotExecutiveText(summary.missionStatement, siteContext),
    narrative: pivotExecutiveText(summary.narrative, siteContext),
    painPointResolution: pivotExecutiveText(summary.painPointResolution, siteContext),
    coreFocusAreas: summary.coreFocusAreas.map((area) =>
      pivotExecutiveText(area, siteContext),
    ),
  };
}

export function applySiteScopeToLaunchRoadmap(
  steps: LaunchRoadmapStep[],
  ctx: TierPlaceholderContext,
): LaunchRoadmapStep[] {
  const siteContext = resolveSiteContext(ctx.form);
  if (siteContext === "brand_new_ground_up") {
    return steps;
  }

  return steps.map((step) => {
    if (step.stepNumber !== 2) {
      return step;
    }

    if (siteContext === "existing_active") {
      return {
        ...step,
        description: step.description.replace(
          /website CMS logins/gi,
          "existing website CMS and analytics access",
        ),
      };
    }

    if (isStrategicArchitectContext(siteContext)) {
      return {
        ...step,
        title: step.title,
        description:
          "Collect GBP admin, analytics access, sandbox/staging environment credentials, platform launch timeline, and creative assets referenced in sales context — aligning pre-launch SEO blueprints to the external builder's execution window.",
      };
    }

    return step;
  });
}

export function applySiteScopeToKeywordMatrix(
  rows: KeywordMatrixRow[],
  ctx: TierPlaceholderContext,
): KeywordMatrixRow[] {
  const siteContext = resolveSiteContext(ctx.form);
  if (siteContext === "brand_new_ground_up") {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    intentCategory: pivotExecutiveText(row.intentCategory, siteContext),
    targetGeography: row.targetGeography,
    keywordVariations: row.keywordVariations.map((kw) =>
      pivotExecutiveText(kw, siteContext),
    ),
  }));
}

export function applySiteScopeToReport(
  report: StrategyMapperReport,
  ctx: TierPlaceholderContext,
): StrategyMapperReport {
  return {
    ...report,
    executiveSummary: applySiteScopeToExecutiveSummary(report.executiveSummary, ctx),
    seoKeywordMatrix: applySiteScopeToKeywordMatrix(report.seoKeywordMatrix, ctx),
    activeStrategies: applySiteScopeToActiveStrategies(report.activeStrategies, ctx),
    launchRoadmap: applySiteScopeToLaunchRoadmap(report.launchRoadmap, ctx),
  };
}
