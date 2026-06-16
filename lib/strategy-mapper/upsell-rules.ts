import type {
  SalesPdfExtract,
  StrategyMapperFormData,
  StrategyMapperReport,
  StrategyMapperResearch,
  StrategyMapperService,
  UpsellDirective,
  UpsellFraming,
} from "@/types/strategy-mapper";
import { ALL_SERVICES } from "@/lib/strategy-mapper/form-options";

function parseRating(value: number | string | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseReviewCount(value: number | string | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getUnselectedServices(
  activeServices: StrategyMapperService[],
): StrategyMapperService[] {
  return ALL_SERVICES.filter((service) => !activeServices.includes(service));
}

export function evaluateUpsellDirectives(
  activeServices: StrategyMapperService[],
  form: StrategyMapperFormData,
  research: StrategyMapperResearch,
): UpsellDirective[] {
  const unselected = getUnselectedServices(activeServices);
  const directives: UpsellDirective[] = [];
  const extract = form.salesPdfExtract;

  const clientRating =
    parseRating(form.clientGoogleRating) ||
    parseRating(research.clientMetrics.googleRating);
  const clientReviews =
    parseReviewCount(form.clientReviewCount) ||
    parseReviewCount(research.clientMetrics.reviewCount);

  const topCompetitorReviews = research.competitors.reduce(
    (max, competitor) => Math.max(max, competitor.reviewCount),
    0,
  );

  const sortedByReviews = [...research.competitors].sort(
    (a, b) => b.reviewCount - a.reviewCount,
  );
  const topThreeReviewCounts = sortedByReviews
    .slice(0, 3)
    .map((c) => c.reviewCount);
  const clientInTopThree =
    topThreeReviewCounts.length === 0 ||
    clientReviews >= Math.min(...topThreeReviewCounts);

  for (const service of unselected) {
    if (service === "orm") {
      const reviewGap = topCompetitorReviews - clientReviews;
      if (reviewGap >= 100 || (clientRating > 0 && clientRating < 4.5)) {
        directives.push({ service, framing: "reputation_gap" });
      }
    } else if (service === "ppc") {
      const competitorsRunAds = research.competitors.some((c) => c.runsGoogleAds);
      if (extract?.clientRunsOwnAds) {
        directives.push({ service, framing: "optimization" });
      } else if (competitorsRunAds) {
        directives.push({ service, framing: "introduction" });
      }
    } else if (service === "social") {
      directives.push({ service, framing: "community" });
    } else if (service === "seo") {
      if (!clientInTopThree) {
        directives.push({ service, framing: "introduction" });
      }
    }
  }

  return directives;
}

/** @deprecated Use evaluateUpsellDirectives */
export function evaluateUpsellTriggers(
  activeServices: StrategyMapperService[],
  form: StrategyMapperFormData,
  research: StrategyMapperResearch,
): StrategyMapperService[] {
  return evaluateUpsellDirectives(activeServices, form, research).map(
    (d) => d.service,
  );
}

export function framingLabel(framing: UpsellFraming): string {
  switch (framing) {
    case "optimization":
      return "Optimization & Integration (client already runs ads)";
    case "introduction":
      return "Introduction / gap fill";
    case "reputation_gap":
      return "Reputation gap vs competitors";
    case "community":
      return "Community trust opportunity";
  }
}

export function clientRunsOwnAdsFromExtract(
  extract?: SalesPdfExtract,
): boolean {
  return extract?.clientRunsOwnAds === true;
}
