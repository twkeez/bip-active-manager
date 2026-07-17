import type { AccountDiagnosticRaw, DiagCampaign, DiagConvAction } from "@/lib/ads/account-diagnostic-fetch";

// Turns the raw pull into a prioritized, explainable diagnosis plus ready-to-apply
// drafts. Deterministic thresholds (no opaque score) so every finding shows its
// "why". Prominence (absolute-top IS + why-not split of lost IS) is the spine;
// conversion tracking is the gate; wasted spend and budget/bid are the levers.

export type Finding = {
  id: string;
  severity: "critical" | "warning" | "opportunity";
  title: string;
  why: string;
  evidence: string;
  action: string;
  impactScore: number;
  impactLabel: string | null;
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

export type AccountDiagnostic = {
  customerId: string;
  window: { start: string; end: string };
  totals: { cost: number; conv: number; cpa: number | null; prevCost: number; prevConv: number };
  tracking: { ok: boolean; severity: "critical" | "warning" | "ok"; note: string; hasCallConv: boolean };
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

export function diagnoseAccount(raw: AccountDiagnosticRaw): AccountDiagnostic {
  const search = raw.campaigns.filter(isSearch);
  const totalCost = round(raw.campaigns.reduce((s, c) => s + c.cost, 0));
  const totalConv = Math.round(raw.campaigns.reduce((s, c) => s + c.conv, 0) * 10) / 10;
  const accountCpa = totalConv > 0 ? round(totalCost / totalConv) : null;

  const tracking = assessTracking(raw.conversionActions, totalConv, totalCost);

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
      findings.push({
        id: `budget-${c.name}`,
        severity: "warning",
        title: `"${c.name}" is leaving calls on the table to budget`,
        why: `It's eligible to show more but capped: ${c.lostBudget}% of impressions are lost to budget while it's converting at ${c.conv > 0 ? `$${round(c.cost / c.conv)} CPA` : "—"}. This is the cleanest growth lever — you're turning off a profitable tap.`,
        evidence: `IS ${c.IS}% · lost to budget ${c.lostBudget}% · ${c.conv} conv · $${c.cost} spend`,
        action: `Raise the daily budget ~${liftPct}% (or tighten geo/schedule to concentrate it) — roughly ~${estExtraConv} more conversions/mo at a similar CPA.`,
        impactScore: 1e6 + estExtraConv * 1000,
        impactLabel: estExtraConv >= 0.5 ? `~${estExtraConv} more conv/mo` : null,
      });
    }
  }

  // Rank-limited campaigns — bid / relevance / landing page.
  for (const c of search) {
    if ((c.lostRank ?? 0) >= LOST_RANK_PCT) {
      findings.push({
        id: `rank-${c.name}`,
        severity: (c.absTopIS ?? 100) < ABS_TOP_LOW ? "warning" : "opportunity",
        title: `"${c.name}" is held back by Ad Rank, not budget`,
        why: `${c.lostRank}% of impressions are lost to rank — your bid and/or relevance aren't strong enough to hold position (abs-top IS ${c.absTopIS ?? "—"}%). Raising budget won't fix this; it's a rank problem.`,
        evidence: `lost to rank ${c.lostRank}% · abs-top IS ${c.absTopIS ?? "—"}% · lost to budget ${c.lostBudget ?? 0}%`,
        action: "Raise bids (or the tCPA/tROAS target), tighten ad-to-keyword relevance, and improve the landing page — the three Ad Rank inputs.",
        impactScore: 800_000 + (c.lostRank ?? 0) * 1000,
        impactLabel: null,
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
    spine,
    findings,
    drafts: { negatives, wastedSpend, budgetMoves, bidMoves, deviceMoves },
  };
}
