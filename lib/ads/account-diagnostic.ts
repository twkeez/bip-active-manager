import type { AccountDiagnosticRaw, DiagCampaign, DiagConvAction, DiagKeyword } from "@/lib/ads/account-diagnostic-fetch";
import { buildGoogleAdsUiUrl } from "@/lib/ads/google-ads-ui-links";
import type { GlobalAdsIssueType } from "@/lib/ads/global-optimization";
import {
  IMPLAUSIBLE_CONV_RATE_MIN_CLICKS,
  IMPLAUSIBLE_CONV_RATE_THRESHOLD,
} from "@/lib/ads/conversion-integrity";
import type { AdsQualityBucket } from "@/lib/types/client";

// Turns the raw pull into a prioritized, explainable diagnosis plus ready-to-apply
// drafts. Deterministic thresholds (no opaque score) so every finding shows its
// "why". Prominence (absolute-top IS + why-not split of lost IS) is the spine;
// conversion tracking is the gate; wasted spend and budget/bid are the levers.

export type FixInput = "landing_page" | "ad_relevance" | "expected_ctr" | "bid" | "mixed";

export type Fix = {
  weakInput: FixInput | null;
  // The one computed, account-specific action line (e.g. the budget number, or
  // which Ad Rank input is weak) — shown above the playbook's general steps.
  headline: string | null;
  // Fallback steps used only when no playbook entry exists for the issue.
  steps: string[];
  culprits: { kw: string; cost: number; note: string }[];
  deepLink: string | null;
  deepLinkLabel: string | null;
  // Present when AI can draft the assets (relevance / CTR problems).
  draft: { campaign: string; keywords: string[] } | null;
};

export type Finding = {
  id: string;
  severity: "critical" | "warning" | "opportunity";
  title: string;
  why: string;
  evidence: string;
  action: string;
  impactScore: number;
  impactLabel: string | null;
  // Best Practices playbook key — the finding's fix is prescribed by that entry.
  issueKey?: string;
  fix?: Fix;
};

const ISSUE_BY_INPUT: Record<FixInput, string> = {
  landing_page: "ads.landing_page_low",
  ad_relevance: "ads.ad_relevance_low",
  expected_ctr: "ads.expected_ctr_low",
  bid: "ads.lost_is_rank",
  mixed: "ads.lost_is_rank",
};

const INPUT_LABEL: Record<FixInput, string> = {
  landing_page: "landing page experience",
  ad_relevance: "ad relevance",
  expected_ctr: "expected CTR",
  bid: "bid — Quality Score is fine",
  mixed: "bid + relevance",
};

export type NegativeDraft = { term: string; cost: number; clicks: number; suggestedMatch: "exact" };
export type BudgetMove = { campaign: string; currentBudget: number; suggestedBudget: number; lostBudgetPct: number; reason: string };
export type BidMove = { campaign: string; issue: string; action: string };
export type DeviceMove = { device: string; detail: string; action: string };

export type SpineRow = {
  campaign: string;
  cost: number;
  conv: number;
  cpa: number | null;
  absTopIS: number | null;
  lostBudget: number | null;
  lostRank: number | null;
  verdict: string;
};

// Conversion-tracking trust — "can you believe these numbers?". The gate before
// any conversion/CPA figure means anything. Each signal is a legible red flag.
export type TrustSignal = {
  id: string;
  severity: "critical" | "warning" | "ok";
  label: string;
  detail: string;
  evidence: string;
};

export type TrustActionRow = {
  name: string;
  category: string;
  type: string;
  counting: string;
  status: string;
  flags: string[];
};

export type ConversionTrust = {
  verdict: "trustworthy" | "shaky" | "broken";
  headline: string;
  accountConvRatePct: number | null; // conversions / clicks, as a percent
  signals: TrustSignal[];
  actions: TrustActionRow[];
};

// Competitor auction insight (surfaced from data we already fetch).
export type AuctionRow = {
  domain: string;
  impressionShare: number | null;
  overlap: number | null;
  outranking: number | null;
};

// Per-keyword Quality Score components — "Below average on one tells you where to work".
export type QsComponentRow = {
  kw: string;
  campaign: string;
  qs: number | null;
  expectedCtr: AdsQualityBucket;
  adRelevance: AdsQualityBucket;
  landingPage: AdsQualityBucket;
  cost: number;
  belowCount: number;
};

export type QsComponents = {
  rows: QsComponentRow[];
  summary: { belowExpectedCtr: number; belowAdRelevance: number; belowLandingPage: number; totalScored: number };
};

export type AccountDiagnostic = {
  customerId: string;
  window: { start: string; end: string };
  totals: { cost: number; conv: number; cpa: number | null; prevCost: number; prevConv: number };
  tracking: { ok: boolean; severity: "critical" | "warning" | "ok"; note: string; hasCallConv: boolean };
  conversionTrust: ConversionTrust;
  auctionInsights: AuctionRow[];
  qsComponents: QsComponents;
  spine: SpineRow[];
  findings: Finding[];
  drafts: {
    negatives: NegativeDraft[];
    wastedSpend: number;
    budgetMoves: BudgetMove[];
    bidMoves: BidMove[];
    deviceMoves: DeviceMove[];
  };
};

// Thresholds — deliberately explicit so the "why" is legible and tunable.
const LOST_BUDGET_PCT = 10; // losing >10% of impressions to budget is worth flagging
const LOST_RANK_PCT = 20; // >20% lost to Ad Rank = a bid/relevance problem
const ABS_TOP_LOW = 25; // <25% of impressions in the top slot = weak prominence
const NEG_MIN_COST = 10; // a search term costing >= $10 with 0 conversions is waste
const HIGH_CPA_MULT = 2; // a campaign at >2x the account CPA is inefficient
const MAX_BUDGET_LIFT = 0.5; // never suggest more than +50% budget in one move

const isSearch = (c: DiagCampaign) => c.channel === "SEARCH";
const round = (n: number) => Math.round(n * 100) / 100;
const belowAvg = (b: AdsQualityBucket) => b === "BELOW_AVERAGE";

const DEEP_LINK_LABEL: Record<GlobalAdsIssueType, string> = {
  ad_relevance: "Ads & assets",
  expected_ctr: "Ad extensions",
  low_quality_score: "Keywords",
  budget_capped: "Campaigns",
  rank_lost: "Campaigns",
};

// Which of the three Ad Rank inputs is the weak link, from the QS components of
// the campaign's keywords (weighted by spend). If nothing is below average, the
// Quality Score is fine and the ceiling is bid, not relevance.
function pinpointRankInput(kws: DiagKeyword[]): { weakInput: FixInput; avgQS: number | null } {
  let lp = 0;
  let rel = 0;
  let ctr = 0;
  let qsW = 0;
  let w = 0;
  for (const k of kws) {
    if (k.cost <= 0) continue;
    if (belowAvg(k.landingPage)) lp += k.cost;
    if (belowAvg(k.adRelevance)) rel += k.cost;
    if (belowAvg(k.expectedCtr)) ctr += k.cost;
    if (k.qs != null) {
      qsW += k.qs * k.cost;
      w += k.cost;
    }
  }
  const avgQS = w > 0 ? Math.round((qsW / w) * 10) / 10 : null;
  const max = Math.max(lp, rel, ctr);
  if (max === 0) return { weakInput: "bid", avgQS };
  if (lp === max) return { weakInput: "landing_page", avgQS };
  if (rel === max) return { weakInput: "ad_relevance", avgQS };
  return { weakInput: "expected_ctr", avgQS };
}

function rankFixSteps(weakInput: FixInput, avgQS: number | null, cpa: number | null): string[] {
  if (weakInput === "landing_page")
    return [
      "The weak Ad Rank input is landing-page experience — Google rates the page people land on as slow or off-topic.",
      "Point these keywords at the most relevant service page (not the homepage), matching the ad's promise + city, with a phone CTA above the fold.",
      "Fix mobile speed — check this client's site audit; compress the hero image and defer non-critical scripts.",
    ];
  if (weakInput === "ad_relevance")
    return [
      "The weak input is ad relevance — the ads don't echo the search term closely enough.",
      "Group the culprit keywords into a tighter ad group so one theme maps to one ad.",
      "Put the keyword theme into the RSA headlines — draft them below.",
    ];
  if (weakInput === "expected_ctr")
    return [
      "The weak input is expected CTR — the ad isn't compelling enough to earn the click at this position.",
      "Add benefit-led headlines and every relevant asset: call, location, sitelinks, callouts, promotions.",
      "Draft stronger headlines below.",
    ];
  if (weakInput === "bid")
    return [
      `Quality Score is actually fine${avgQS != null ? ` (avg ${avgQS})` : ""} — you're losing position on bid, not relevance.`,
      cpa != null
        ? `Raise the target: if on Maximize Conversions, set a tCPA near your current $${cpa}; if manual, lift max CPC ~15–20%.`
        : "Raise the target CPA/ROAS or lift max CPC ~15–20%.",
      "Recheck absolute-top IS after a week — it should climb as you hold position more often.",
    ];
  return ["Mixed signal — raise bids and tighten ad-to-keyword relevance together, then re-measure."];
}

function buildRankFix(customerId: string, c: DiagCampaign, kws: DiagKeyword[], cpa: number | null): Fix {
  const { weakInput, avgQS } = pinpointRankInput(kws);
  const compKey: keyof DiagKeyword | null =
    weakInput === "landing_page" ? "landingPage" : weakInput === "ad_relevance" ? "adRelevance" : weakInput === "expected_ctr" ? "expectedCtr" : null;
  const culprits = (compKey ? kws.filter((k) => belowAvg(k[compKey] as AdsQualityBucket)) : [...kws])
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)
    .map((k) => ({ kw: k.kw, cost: k.cost, note: k.qs != null ? `QS ${k.qs}` : "" }));
  const issueType: GlobalAdsIssueType =
    weakInput === "ad_relevance" ? "ad_relevance" : weakInput === "expected_ctr" ? "expected_ctr" : weakInput === "bid" ? "rank_lost" : "low_quality_score";
  const deepLink = buildGoogleAdsUiUrl({ adsCustomerId: customerId, issueType, campaignId: c.id });
  const draft = weakInput === "ad_relevance" || weakInput === "expected_ctr" ? { campaign: c.name, keywords: culprits.map((k) => k.kw) } : null;
  return {
    weakInput,
    headline: `Weak Ad Rank input: ${INPUT_LABEL[weakInput]}.`,
    steps: rankFixSteps(weakInput, avgQS, cpa),
    culprits,
    deepLink,
    deepLinkLabel: DEEP_LINK_LABEL[issueType],
    draft,
  };
}

function assessTracking(actions: DiagConvAction[], totalConv: number, totalCost: number) {
  const enabled = actions.filter((a) => a.status === "ENABLED");
  const hasCallConv = enabled.some(
    (a) => /CALL/i.test(a.category) || /CALL/i.test(a.type) || /call/i.test(a.name),
  );
  if (enabled.length === 0) {
    return {
      ok: false,
      severity: "critical" as const,
      note: "No enabled conversion actions — this account is optimizing blind. Nothing else here can be trusted until leads are tracked.",
      hasCallConv,
    };
  }
  if (totalCost > 0 && totalConv === 0) {
    return {
      ok: false,
      severity: "critical" as const,
      note: `${enabled.length} conversion action(s) exist but recorded 0 conversions on real spend — tracking is likely broken or not firing.`,
      hasCallConv,
    };
  }
  if (!hasCallConv) {
    return {
      ok: true,
      severity: "warning" as const,
      note: "No phone-call conversion detected. For a practice that runs on calls, add call-from-ads + a call length threshold so calls count as leads.",
      hasCallConv,
    };
  }
  return { ok: true, severity: "ok" as const, note: `${enabled.length} conversion actions enabled, calls tracked.`, hasCallConv };
}

// Conversion categories where counting "every" is legitimate (a sale can happen
// repeatedly). For everything else — leads, calls, bookings — "every" inflates.
const PURCHASE_CATEGORIES = new Set(["PURCHASE", "ADD_TO_CART", "BEGIN_CHECKOUT", "STORE_SALE", "SUBSCRIBE_PAID"]);
const isLeadCategory = (category: string) => !PURCHASE_CATEGORIES.has((category ?? "").toUpperCase());
const isCallAction = (a: DiagConvAction) => /CALL/i.test(a.category) || /CALL/i.test(a.type) || /call/i.test(a.name);
const countsEvery = (a: DiagConvAction) => /MANY/i.test(a.counting);

// Builds the conversion-tracking trust view: rate anomalies (pixel loops,
// implausibly high rates), misconfigured counting/categories, and missing call
// tracking — the gate before any conversion or CPA number can be believed.
function buildConversionTrust(
  raw: AccountDiagnosticRaw,
  totalClicks: number,
  totalConv: number,
  totalCost: number,
): ConversionTrust {
  const enabled = raw.conversionActions.filter((a) => a.status === "ENABLED");
  const signals: TrustSignal[] = [];
  const accountConvRate = totalClicks > 0 ? totalConv / totalClicks : null;

  if (enabled.length === 0) {
    signals.push({
      id: "none",
      severity: "critical",
      label: "No conversion tracking",
      detail:
        "No enabled conversion actions — the account is optimizing blind. No conversion or CPA figure here can be trusted until leads are tracked.",
      evidence: "0 enabled conversion actions",
    });
  } else if (totalCost > 0 && totalConv === 0) {
    signals.push({
      id: "not_firing",
      severity: "critical",
      label: "Spending with zero conversions",
      detail: "Real spend but nothing recorded — the conversion tag likely isn't firing at all.",
      evidence: `$${round(totalCost)} spend · 0 conversions`,
    });
  }

  // Pixel loop: more conversions than clicks (rate > 100%).
  const loops = raw.campaigns.filter((c) => c.clicks > IMPLAUSIBLE_CONV_RATE_MIN_CLICKS && c.conv >= c.clicks);
  if (loops.length > 0) {
    const worst = [...loops].sort((a, b) => b.conv / b.clicks - a.conv / a.clicks)[0]!;
    signals.push({
      id: "loop",
      severity: "critical",
      label: "Impossible conversion rate (over 100%)",
      detail:
        "At least one campaign records more conversions than clicks — the classic signature of a tag firing on every page load, or a thank-you page that reloads.",
      evidence: `${loops.length} campaign(s) · worst: "${worst.name}" ${worst.conv} conv on ${worst.clicks} clicks`,
    });
  }

  // Implausibly high (but under 100%) conversion rate — the "excessive rate" tell.
  const highRate = raw.campaigns.filter(
    (c) =>
      c.clicks > IMPLAUSIBLE_CONV_RATE_MIN_CLICKS &&
      c.conv < c.clicks &&
      c.conv / c.clicks > IMPLAUSIBLE_CONV_RATE_THRESHOLD,
  );
  if (highRate.length > 0) {
    const worst = [...highRate].sort((a, b) => b.conv / b.clicks - a.conv / a.clicks)[0]!;
    signals.push({
      id: "high_rate",
      severity: "warning",
      label: "Suspiciously high conversion rate",
      detail: `Conversion rates above ${Math.round(
        IMPLAUSIBLE_CONV_RATE_THRESHOLD * 100,
      )}% are rare for genuine leads — usually a page view or form load being counted as a conversion. Worth verifying what actually fires.`,
      evidence: `${highRate.length} campaign(s) · worst: "${worst.name}" ${Math.round(
        (worst.conv / worst.clicks) * 100,
      )}% (${worst.conv} conv / ${worst.clicks} clicks)`,
    });
  }

  // Counting "every" on a lead action inflates the count.
  const countEvery = enabled.filter((a) => countsEvery(a) && isLeadCategory(a.category) && !isCallAction(a));
  if (countEvery.length > 0) {
    signals.push({
      id: "counting",
      severity: "warning",
      label: 'Counting "every" conversion on a lead action',
      detail:
        'Lead actions (form fills, bookings) should count "One" per click — "Every" inflates the number when one visitor triggers it more than once.',
      evidence: countEvery.map((a) => a.name).slice(0, 4).join(", ") || `${countEvery.length} action(s)`,
    });
  }

  // A page view counted as a conversion.
  const pageViews = enabled.filter((a) => /PAGE_VIEW/i.test(a.category));
  if (pageViews.length > 0) {
    signals.push({
      id: "page_view",
      severity: "warning",
      label: "A page view is counted as a conversion",
      detail:
        "A page-view conversion action means ordinary visits are being counted as leads — one of the most common reasons conversion counts look inflated.",
      evidence: pageViews.map((a) => a.name).slice(0, 4).join(", ") || `${pageViews.length} action(s)`,
    });
  }

  // Missing call tracking for a call-driven practice.
  if (enabled.length > 0 && !enabled.some(isCallAction)) {
    signals.push({
      id: "no_call",
      severity: "warning",
      label: "No phone-call conversion",
      detail:
        "For a practice that runs on phone calls, calls from ads should be a tracked conversion (with a minimum call length) — otherwise your best leads are invisible to the account.",
      evidence: "No call-category action among enabled conversions",
    });
  }

  const hasCrit = signals.some((s) => s.severity === "critical");
  const hasWarn = signals.some((s) => s.severity === "warning");
  const verdict: ConversionTrust["verdict"] = hasCrit ? "broken" : hasWarn ? "shaky" : "trustworthy";
  if (!hasCrit && !hasWarn) {
    signals.push({
      id: "ok",
      severity: "ok",
      label: "Tracking looks trustworthy",
      detail: `${enabled.length} enabled conversion action(s), a plausible conversion rate, and calls tracked.`,
      evidence: `${enabled.length} enabled · ${accountConvRate != null ? `${Math.round(accountConvRate * 100)}% conv rate` : "—"}`,
    });
  }
  const headline =
    verdict === "broken"
      ? "Don't trust these conversion numbers yet — fix tracking first."
      : verdict === "shaky"
        ? "Treat these conversion numbers with caution — a few things look off."
        : "Conversion tracking looks trustworthy.";

  const actions: TrustActionRow[] = enabled.map((a) => {
    const flags: string[] = [];
    if (countsEvery(a) && isLeadCategory(a.category) && !isCallAction(a)) flags.push("counts every");
    if (/PAGE_VIEW/i.test(a.category)) flags.push("page view");
    if (isCallAction(a)) flags.push("call");
    return { name: a.name, category: a.category, type: a.type, counting: a.counting, status: a.status, flags };
  });

  return {
    verdict,
    headline,
    accountConvRatePct: accountConvRate != null ? Math.round(accountConvRate * 1000) / 10 : null,
    signals,
    actions,
  };
}

// Top competitors from auction insights — data already fetched, previously unused.
function buildAuctionInsights(raw: AccountDiagnosticRaw): AuctionRow[] {
  return raw.auction
    .slice(0, 12)
    .map((a) => ({ domain: a.domain, impressionShare: a.IS, overlap: a.overlap, outranking: a.outranking }));
}

// Per-keyword QS components, surfacing the keywords with a Below-average lever.
function buildQsComponents(raw: AccountDiagnosticRaw): QsComponents {
  const hasBucket = (b: AdsQualityBucket) => b === "BELOW_AVERAGE" || b === "AVERAGE" || b === "ABOVE_AVERAGE";
  const isBelow = (b: AdsQualityBucket) => b === "BELOW_AVERAGE";
  const rows: QsComponentRow[] = raw.keywords
    .filter((k) => isBelow(k.expectedCtr) || isBelow(k.adRelevance) || isBelow(k.landingPage))
    .map((k) => ({
      kw: k.kw,
      campaign: k.campaign,
      qs: k.qs,
      expectedCtr: k.expectedCtr,
      adRelevance: k.adRelevance,
      landingPage: k.landingPage,
      cost: k.cost,
      belowCount: [k.expectedCtr, k.adRelevance, k.landingPage].filter(isBelow).length,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 15);
  return {
    rows,
    summary: {
      belowExpectedCtr: raw.keywords.filter((k) => isBelow(k.expectedCtr)).length,
      belowAdRelevance: raw.keywords.filter((k) => isBelow(k.adRelevance)).length,
      belowLandingPage: raw.keywords.filter((k) => isBelow(k.landingPage)).length,
      totalScored: raw.keywords.filter(
        (k) => hasBucket(k.expectedCtr) || hasBucket(k.adRelevance) || hasBucket(k.landingPage) || k.qs != null,
      ).length,
    },
  };
}

export function diagnoseAccount(raw: AccountDiagnosticRaw): AccountDiagnostic {
  const search = raw.campaigns.filter(isSearch);
  const totalCost = round(raw.campaigns.reduce((s, c) => s + c.cost, 0));
  const totalConv = Math.round(raw.campaigns.reduce((s, c) => s + c.conv, 0) * 10) / 10;
  const totalClicks = raw.campaigns.reduce((s, c) => s + c.clicks, 0);
  const accountCpa = totalConv > 0 ? round(totalCost / totalConv) : null;

  const tracking = assessTracking(raw.conversionActions, totalConv, totalCost);
  const conversionTrust = buildConversionTrust(raw, totalClicks, totalConv, totalCost);
  const auctionInsights = buildAuctionInsights(raw);
  const qsComponents = buildQsComponents(raw);

  const spine: SpineRow[] = search.map((c) => {
    const cpa = c.conv > 0 ? round(c.cost / c.conv) : null;
    let verdict = "Holding position";
    if ((c.lostBudget ?? 0) >= LOST_BUDGET_PCT && (c.lostBudget ?? 0) >= (c.lostRank ?? 0)) {
      verdict = "Capped by budget";
    } else if ((c.lostRank ?? 0) >= LOST_RANK_PCT) {
      verdict = "Held back by Ad Rank";
    } else if ((c.absTopIS ?? 100) < ABS_TOP_LOW) {
      verdict = "Low top-of-page presence";
    }
    return { campaign: c.name, cost: c.cost, conv: c.conv, cpa, absTopIS: c.absTopIS, lostBudget: c.lostBudget, lostRank: c.lostRank, verdict };
  });

  const findings: Finding[] = [];

  if (!tracking.ok) {
    findings.push({
      id: "tracking",
      severity: "critical",
      title: "Conversion tracking is unreliable",
      why: tracking.note,
      evidence: `${raw.conversionActions.filter((a) => a.status === "ENABLED").length} enabled actions · ${totalConv} conversions on $${totalCost} spend`,
      action: "Fix conversion tracking before optimizing anything else — verify the tag fires, set calls (60s+) as a conversion, and mark the true lead action as Primary.",
      impactScore: 1e9,
      impactLabel: "Foundational",
      issueKey: "ads.conversion_tracking",
    });
  } else if (tracking.severity === "warning") {
    findings.push({
      id: "tracking-calls",
      severity: "warning",
      title: "Phone calls may not be counted as conversions",
      why: tracking.note,
      evidence: "No call-category conversion action found among enabled actions.",
      action: "Add a 'Calls from ads' conversion with a 60-second minimum so call leads are optimized toward.",
      impactScore: 5e6,
      impactLabel: null,
      issueKey: "ads.conversion_tracking",
    });
  }

  // Budget-capped converting campaigns — raise budget / tighten geo.
  for (const c of search) {
    if ((c.lostBudget ?? 0) >= LOST_BUDGET_PCT && c.conv > 0 && c.IS != null) {
      // Estimate against the budget lift we actually recommend (not the
      // theoretical ceiling of recapturing all lost-budget impressions).
      const lift = Math.min(MAX_BUDGET_LIFT, (c.lostBudget ?? 0) / 100);
      const liftPct = Math.round(lift * 100);
      const estExtraConv = Math.round(c.conv * lift * 10) / 10;
      const suggested = round(c.budget * (1 + lift));
      findings.push({
        id: `budget-${c.name}`,
        severity: "warning",
        title: `"${c.name}" is leaving calls on the table to budget`,
        why: `It's eligible to show more but capped: ${c.lostBudget}% of impressions are lost to budget while it's converting at ${c.conv > 0 ? `$${round(c.cost / c.conv)} CPA` : "—"}. This is the cleanest growth lever — you're turning off a profitable tap.`,
        evidence: `IS ${c.IS}% · lost to budget ${c.lostBudget}% · ${c.conv} conv · $${c.cost} spend`,
        action: `Raise the daily budget ~${liftPct}% (or tighten geo/schedule to concentrate it) — roughly ~${estExtraConv} more conversions/mo at a similar CPA.`,
        impactScore: 1e6 + estExtraConv * 1000,
        impactLabel: estExtraConv >= 0.5 ? `~${estExtraConv} more conv/mo` : null,
        issueKey: "ads.lost_is_budget",
        fix: {
          weakInput: null,
          headline: `Raise the daily budget from $${c.budget} to ~$${suggested}.`,
          steps: [
            `Raise the daily budget from $${c.budget} to ~$${suggested}.`,
            "Or tighten the geo radius / dayparting so the same budget concentrates on peak call hours.",
            "Recheck lost-to-budget after a week — it should drop toward zero.",
          ],
          culprits: [],
          deepLink: buildGoogleAdsUiUrl({ adsCustomerId: raw.customerId, issueType: "budget_capped", campaignId: c.id }),
          deepLinkLabel: DEEP_LINK_LABEL.budget_capped,
          draft: null,
        },
      });
    }
  }

  // Rank-limited campaigns — pinpoint which Ad Rank input is weak.
  for (const c of search) {
    if ((c.lostRank ?? 0) >= LOST_RANK_PCT) {
      const cpa = c.conv > 0 ? round(c.cost / c.conv) : null;
      const kws = raw.keywords.filter((k) => (c.id && k.campaignId === c.id) || k.campaign === c.name);
      const fix = buildRankFix(raw.customerId, c, kws, cpa);
      const alsoBudget = (c.lostBudget ?? 0) >= LOST_BUDGET_PCT;
      findings.push({
        id: `rank-${c.name}`,
        severity: (c.absTopIS ?? 100) < ABS_TOP_LOW ? "warning" : "opportunity",
        title: `"${c.name}" is held back by Ad Rank, not budget`,
        why: `${c.lostRank}% of impressions are lost to rank — your bid and/or relevance aren't strong enough to hold position (abs-top IS ${c.absTopIS ?? "—"}%). Raising budget won't fix this; it's a rank problem.${alsoBudget ? ` It's also losing ${c.lostBudget}% to budget — but fix rank first: better Quality Score lowers your CPCs, so the budget you already have stretches further, then top it up.` : ""}`,
        evidence: `lost to rank ${c.lostRank}% · abs-top IS ${c.absTopIS ?? "—"}% · lost to budget ${c.lostBudget ?? 0}%`,
        action: fix.steps[0],
        impactScore: 800_000 + (c.lostRank ?? 0) * 1000,
        impactLabel: null,
        issueKey: fix.weakInput ? ISSUE_BY_INPUT[fix.weakInput] : "ads.lost_is_rank",
        fix,
      });
    }
  }

  // Wasted spend on non-converting search terms → negatives.
  const wasteTerms = raw.searchTerms
    .filter((t) => t.conv === 0 && t.cost >= NEG_MIN_COST)
    .sort((a, b) => b.cost - a.cost);
  const wastedSpend = round(wasteTerms.reduce((s, t) => s + t.cost, 0));
  if (wasteTerms.length > 0) {
    findings.push({
      id: "waste",
      severity: wastedSpend > totalCost * 0.15 ? "warning" : "opportunity",
      title: `$${wastedSpend} on search terms that never convert`,
      why: `${wasteTerms.length} search terms cost $${NEG_MIN_COST}+ each with zero conversions — money spent on the wrong searches. Adding them as negatives redirects that budget to terms that work.`,
      evidence: `${wasteTerms.length} terms · $${wastedSpend} (${totalCost > 0 ? Math.round((wastedSpend / totalCost) * 100) : 0}% of spend)`,
      action: `Add the ${wasteTerms.length} drafted negative keywords below.`,
      impactScore: 900_000 + wastedSpend * 100,
      impactLabel: `$${wastedSpend}/mo recoverable`,
      issueKey: "ads.wasted_spend",
    });
  }

  // High-CPA campaigns vs. the account.
  if (accountCpa != null) {
    for (const c of search) {
      const cpa = c.conv > 0 ? round(c.cost / c.conv) : null;
      if (cpa != null && cpa > accountCpa * HIGH_CPA_MULT && c.cost >= NEG_MIN_COST) {
        findings.push({
          id: `cpa-${c.name}`,
          severity: "opportunity",
          title: `"${c.name}" converts at ${Math.round(cpa / accountCpa)}× the account CPA`,
          why: `Its $${cpa} CPA is well above the account's $${accountCpa}. Either its targeting/terms are looser or its landing page converts worse — it's dragging efficiency.`,
          evidence: `$${cpa} CPA vs $${accountCpa} account · $${c.cost} spend · ${c.conv} conv`,
          action: "Audit this campaign's search terms and landing page, or shift its budget toward the efficient campaigns.",
          impactScore: 400_000 + (cpa - accountCpa) * 100,
          impactLabel: null,
          issueKey: "ads.high_cpa",
        });
      }
    }
  }

  // Device efficiency.
  const deviceMoves: DeviceMove[] = [];
  const devTotalConv = raw.device.reduce((s, d) => s + d.conv, 0);
  for (const d of raw.device) {
    if (d.cost < Math.max(NEG_MIN_COST, totalCost * 0.1)) continue;
    const dCpa = d.conv > 0 ? round(d.cost / d.conv) : null;
    if (d.conv === 0 && d.cost >= NEG_MIN_COST) {
      deviceMoves.push({ device: d.device, detail: `$${d.cost} spend, 0 conversions`, action: "Apply a strong negative bid adjustment or exclude." });
    } else if (dCpa != null && accountCpa != null && dCpa > accountCpa * HIGH_CPA_MULT) {
      deviceMoves.push({ device: d.device, detail: `$${dCpa} CPA vs $${accountCpa} account`, action: "Apply a negative bid adjustment to rebalance toward efficient devices." });
    }
  }
  if (deviceMoves.length > 0 && devTotalConv > 0) {
    findings.push({
      id: "device",
      severity: "opportunity",
      title: "Spend is skewed to an underperforming device",
      why: "One device is spending real money at a much worse (or zero) conversion rate. A bid adjustment rebalances toward where leads actually come from.",
      evidence: deviceMoves.map((m) => `${m.device}: ${m.detail}`).join(" · "),
      action: "Apply the drafted device bid adjustments below.",
      impactScore: 300_000,
      impactLabel: null,
    });
  }

  findings.sort((a, b) => b.impactScore - a.impactScore);

  // Drafts.
  const negatives: NegativeDraft[] = wasteTerms
    .slice(0, 50)
    .map((t) => ({ term: t.term, cost: t.cost, clicks: t.clicks, suggestedMatch: "exact" as const }));

  const budgetMoves: BudgetMove[] = search
    .filter((c) => (c.lostBudget ?? 0) >= LOST_BUDGET_PCT && c.conv > 0)
    .map((c) => {
      const lift = Math.min(MAX_BUDGET_LIFT, (c.lostBudget ?? 0) / 100);
      return {
        campaign: c.name,
        currentBudget: c.budget,
        suggestedBudget: round(c.budget * (1 + lift)),
        lostBudgetPct: c.lostBudget ?? 0,
        reason: `${c.lostBudget}% of impressions lost to budget while converting at $${c.conv > 0 ? round(c.cost / c.conv) : "—"} CPA.`,
      };
    });

  const bidMoves: BidMove[] = search
    .filter((c) => (c.lostRank ?? 0) >= LOST_RANK_PCT)
    .map((c) => ({
      campaign: c.name,
      issue: `${c.lostRank}% lost to Ad Rank · abs-top IS ${c.absTopIS ?? "—"}%`,
      action: c.bidStrategy?.includes("MAXIMIZE") ? "On an automated strategy — raise/set the tCPA/tROAS target and improve relevance + landing page." : "Raise keyword bids and improve ad-to-keyword relevance + landing page.",
    }));

  return {
    customerId: raw.customerId,
    window: raw.window,
    totals: { cost: totalCost, conv: totalConv, cpa: accountCpa, prevCost: raw.prev.cost, prevConv: raw.prev.conv },
    tracking,
    conversionTrust,
    auctionInsights,
    qsComponents,
    spine,
    findings,
    drafts: { negatives, wastedSpend, budgetMoves, bidMoves, deviceMoves },
  };
}
