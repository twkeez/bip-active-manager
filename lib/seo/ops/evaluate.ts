import { getClientActiveServices, isServiceActive } from "@/lib/clients/service-active";
import { buildPage2Opportunities } from "@/lib/seo/page2-opportunities";
import { countSignificantFluctuations } from "@/lib/seo/rank-fluctuations";
import { daysSinceIso, isoWeekPeriodKey, monthPeriodKey } from "@/lib/seo/ops/periods";
import type {
  SeoOpsCompletion,
  SeoOpsEvaluation,
  SeoOpsItemStatus,
  SeoOpsQueueSummary,
  SeoOpsTemplate,
} from "@/lib/seo/ops/types";
import type {
  ClientKeywordTarget,
  ClientRow,
  GbpReviewRow,
  GscQueryMetric,
  GscSignal,
  GscSnapshot,
  KeywordHealthRow,
  SeoCrawlSnapshot,
} from "@/lib/types/client";

export type SeoOpsEvaluationContext = {
  gscSnapshot: GscSnapshot | null;
  gscSignals: GscSignal[];
  gscQueryMetrics: GscQueryMetric[];
  seoCrawlSnapshot: SeoCrawlSnapshot | null;
  gbpReviews: GbpReviewRow[];
  keywordHealthRows: KeywordHealthRow[];
  keywordHealthRefreshedAt: string | null;
  keywordTargets: ClientKeywordTarget[];
};

function actionTabForVerification(verification: string) {
  if (verification.startsWith("auto:gsc") || verification.startsWith("auto:rank")) {
    return "reporting" as const;
  }
  if (verification === "manual:gbp_engagement") return "reporting" as const;
  if (verification === "manual:on_page_refresh") return "seo" as const;
  if (verification.startsWith("auto:gsc_page2")) return "seo_ops" as const;
  return "seo_ops" as const;
}

function completionForItem(
  completions: SeoOpsCompletion[],
  itemKey: string,
  periodKey: string,
) {
  return completions.find(
    (row) => row.item_key === itemKey && row.period_key === periodKey,
  );
}

function evaluateAutoGscHealth(ctx: SeoOpsEvaluationContext) {
  const gscAgeDays = daysSinceIso(ctx.gscSnapshot?.updated_at ?? null);
  const criticalCount = ctx.gscSignals.filter((signal) => signal.severity === "critical").length;
  const crawlAgeDays = daysSinceIso(ctx.seoCrawlSnapshot?.updated_at ?? null);

  if (!ctx.gscSnapshot) {
    return { done: false, hint: "Sync Search Console to run the sanity check." };
  }
  if (gscAgeDays != null && gscAgeDays > 7) {
    return {
      done: false,
      hint: `GSC data is ${gscAgeDays} days old — sync Search Console.`,
    };
  }
  if (criticalCount > 0) {
    return {
      done: false,
      hint: `${criticalCount} critical GSC signal${criticalCount === 1 ? "" : "s"} need review.`,
    };
  }
  if (crawlAgeDays == null || crawlAgeDays > 30) {
    return {
      done: false,
      hint: "Run an SEO crawl (or site audit) within the last 30 days.",
    };
  }
  return { done: true, hint: null };
}

function evaluateAutoRankFluctuations(ctx: SeoOpsEvaluationContext) {
  const refreshedAgeDays = daysSinceIso(ctx.keywordHealthRefreshedAt);
  if (refreshedAgeDays == null) {
    return {
      done: false,
      hint: "Refresh keyword health this week to scan rank movement.",
    };
  }
  if (refreshedAgeDays > 7) {
    return {
      done: false,
      hint: `Keyword health is ${refreshedAgeDays} days old — refresh to scan ranks.`,
    };
  }

  const { tracked, rows } = countSignificantFluctuations(
    ctx.keywordHealthRows,
    ctx.keywordTargets,
    5,
  );
  if (tracked > 0) {
    const sample = rows
      .filter((row) => row.isTracked)
      .slice(0, 2)
      .map((row) => `"${row.keyword}" (${row.delta > 0 ? "+" : ""}${row.delta.toFixed(1)})`)
      .join(", ");
    return {
      done: false,
      hint: `${tracked} tracked keyword${tracked === 1 ? "" : "s"} moved ±5 positions: ${sample}. Review and mark complete.`,
    };
  }
  if (rows.length > 0) {
    return {
      done: true,
      hint: `${rows.length} non-tracked keyword${rows.length === 1 ? "" : "s"} moved ±5 — no tracked swings.`,
    };
  }
  return { done: true, hint: "No significant rank swings detected." };
}

function evaluateAutoGscPage2(
  ctx: SeoOpsEvaluationContext,
  completion: SeoOpsCompletion | undefined,
) {
  const opportunities = buildPage2Opportunities(ctx.gscQueryMetrics);
  if (completion?.completed_at || completion?.viewed_at) {
    return {
      done: true,
      hint:
        opportunities.length > 0
          ? `${opportunities.length} page-2 opportunit${opportunities.length === 1 ? "y" : "ies"} reviewed.`
          : null,
    };
  }
  if (opportunities.length === 0) {
    return {
      done: false,
      hint: "No page-2 queries found yet — sync GSC or widen the date range.",
    };
  }
  const top = opportunities[0]!;
  return {
    done: false,
    hint: `${opportunities.length} queries on page 2 (top: "${top.query}" at ${top.position.toFixed(1)}, ${top.impressions} impr.). Review the list below.`,
  };
}

function evaluateManualGbp(ctx: SeoOpsEvaluationContext) {
  const recentReviews = ctx.gbpReviews.filter(
    (row) =>
      row.review_time_unix != null &&
      row.review_time_unix >= Math.floor((Date.now() - 14 * 86400000) / 1000),
  );
  if (recentReviews.length === 0) {
    return { done: false, hint: "Respond to new reviews and publish one weekly GBP post." };
  }
  return {
    done: false,
    hint: `${recentReviews.length} review${recentReviews.length === 1 ? "" : "s"} in the last 14 days — respond with localized keywords and publish a weekly post.`,
  };
}

function evaluateAutoItem(
  template: SeoOpsTemplate,
  ctx: SeoOpsEvaluationContext,
  completion: SeoOpsCompletion | undefined,
): { done: boolean; autoVerified: boolean; hint: string | null } {
  if (completion?.completed_at) {
    return { done: true, autoVerified: false, hint: null };
  }

  const verification = template.verification;
  if (verification === "auto:gsc_health") {
    const result = evaluateAutoGscHealth(ctx);
    return { ...result, autoVerified: result.done };
  }
  if (verification === "auto:rank_fluctuations") {
    const result = evaluateAutoRankFluctuations(ctx);
    return { ...result, autoVerified: result.done };
  }
  if (verification === "auto:gsc_page2") {
    const result = evaluateAutoGscPage2(ctx, completion);
    return { ...result, autoVerified: Boolean(completion?.viewed_at) && result.done };
  }
  if (verification === "manual:gbp_engagement") {
    const result = evaluateManualGbp(ctx);
    return { ...result, autoVerified: false };
  }
  if (verification === "manual:on_page_refresh") {
    return {
      done: false,
      autoVerified: false,
      hint: "Pick one primary service page and refresh title, H1, H2s, and image alt text.",
    };
  }
  if (verification === "manual:internal_links") {
    return {
      done: false,
      autoVerified: false,
      hint: "Add 2–3 contextual internal links from older posts to a money page.",
    };
  }
  return { done: false, autoVerified: false, hint: null };
}

function shouldIncludeTemplate(template: SeoOpsTemplate, client: ClientRow) {
  if (!template.is_active) return false;
  const services = getClientActiveServices(client);
  if (!services.seo) return false;
  if (template.requires_service === "blog" && !services.blog) return false;
  return true;
}

function evaluateTemplateItem(
  template: SeoOpsTemplate,
  client: ClientRow,
  ctx: SeoOpsEvaluationContext,
  completions: SeoOpsCompletion[],
): SeoOpsItemStatus {
  if (!shouldIncludeTemplate(template, client)) {
    return {
      itemKey: template.item_key,
      label: template.label,
      cadence: template.cadence,
      verification: template.verification,
      sortOrder: template.sort_order,
      done: true,
      autoVerified: false,
      skipped: true,
      skipReason: "SEO service not active or item disabled.",
      hint: null,
      completedAt: null,
      notes: null,
      actionTab: null,
    };
  }

  const periodKey =
    template.cadence === "weekly" ? isoWeekPeriodKey() : monthPeriodKey();
  const completion = completionForItem(completions, template.item_key, periodKey);
  const auto = evaluateAutoItem(template, ctx, completion);

  return {
    itemKey: template.item_key,
    label: template.label,
    cadence: template.cadence,
    verification: template.verification,
    sortOrder: template.sort_order,
    done: auto.done,
    autoVerified: auto.autoVerified,
    skipped: false,
    skipReason: null,
    hint: auto.hint,
    completedAt: completion?.completed_at ?? null,
    notes: completion?.notes ?? null,
    actionTab: actionTabForVerification(template.verification),
  };
}

function progressForItems(items: SeoOpsItemStatus[]) {
  const active = items.filter((item) => !item.skipped);
  const doneCount = active.filter((item) => item.done).length;
  const totalCount = active.length;
  const progressPercent =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100;
  return { doneCount, totalCount, progressPercent };
}

function computeUrgencyScore(
  weeklyItems: SeoOpsItemStatus[],
  monthlyItems: SeoOpsItemStatus[],
  ctx: SeoOpsEvaluationContext,
) {
  let score = 0;
  for (const item of [...weeklyItems, ...monthlyItems]) {
    if (item.skipped || item.done) continue;
    score += item.cadence === "weekly" ? 3 : 2;
  }
  const gscAgeDays = daysSinceIso(ctx.gscSnapshot?.updated_at ?? null);
  if (gscAgeDays != null && gscAgeDays > 7) score += 2;
  const criticalCount = ctx.gscSignals.filter((signal) => signal.severity === "critical").length;
  score += criticalCount * 2;
  return score;
}

function topBlockerHint(items: SeoOpsItemStatus[]) {
  const open = items.filter((item) => !item.skipped && !item.done);
  return open[0]?.hint ?? open[0]?.label ?? null;
}

export function evaluateSeoOpsClient(
  client: ClientRow,
  templates: SeoOpsTemplate[],
  completions: SeoOpsCompletion[],
  ctx: SeoOpsEvaluationContext,
): SeoOpsEvaluation {
  const weeklyTemplates = templates
    .filter((row) => row.cadence === "weekly")
    .sort((a, b) => a.sort_order - b.sort_order);
  const monthlyTemplates = templates
    .filter((row) => row.cadence === "monthly")
    .sort((a, b) => a.sort_order - b.sort_order);

  const weeklyItems = weeklyTemplates.map((template) =>
    evaluateTemplateItem(template, client, ctx, completions),
  );
  const monthlyItems = monthlyTemplates.map((template) =>
    evaluateTemplateItem(template, client, ctx, completions),
  );

  const weeklyProgress = progressForItems(weeklyItems);
  const monthlyProgress = progressForItems(monthlyItems);

  return {
    clientId: client.id,
    accountName: client.account_name,
    marketingStrategist: client.marketing_strategist,
    weeklyPeriodKey: isoWeekPeriodKey(),
    monthlyPeriodKey: monthPeriodKey(),
    weeklyItems,
    monthlyItems,
    weeklyProgressPercent: weeklyProgress.progressPercent,
    monthlyProgressPercent: monthlyProgress.progressPercent,
    weeklyDoneCount: weeklyProgress.doneCount,
    weeklyTotalCount: weeklyProgress.totalCount,
    monthlyDoneCount: monthlyProgress.doneCount,
    monthlyTotalCount: monthlyProgress.totalCount,
    urgencyScore: computeUrgencyScore(weeklyItems, monthlyItems, ctx),
    topBlockerHint: topBlockerHint([...weeklyItems, ...monthlyItems]),
    gscSnapshotUpdatedAt: ctx.gscSnapshot?.updated_at ?? null,
  };
}

export function summarizeSeoOpsQueue(evaluations: SeoOpsEvaluation[]): SeoOpsQueueSummary {
  const seoClients = evaluations.filter((row) => row.weeklyTotalCount > 0);
  return {
    seoClientCount: seoClients.length,
    weeklyIncomplete: seoClients.filter((row) => row.weeklyDoneCount < row.weeklyTotalCount)
      .length,
    monthlyIncomplete: seoClients.filter(
      (row) => row.monthlyDoneCount < row.monthlyTotalCount,
    ).length,
    needsAttention: seoClients.filter((row) => row.urgencyScore >= 3).length,
  };
}

export function isSeoOpsEligibleClient(client: Pick<ClientRow, "seo">) {
  return isServiceActive(client.seo);
}

export function emptySeoOpsContext(): SeoOpsEvaluationContext {
  return {
    gscSnapshot: null,
    gscSignals: [],
    gscQueryMetrics: [],
    seoCrawlSnapshot: null,
    gbpReviews: [],
    keywordHealthRows: [],
    keywordHealthRefreshedAt: null,
    keywordTargets: [],
  };
}
