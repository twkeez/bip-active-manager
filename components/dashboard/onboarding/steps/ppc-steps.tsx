"use client";

import { useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { CampaignPlan, CompetitorOffer, StepModule, StepModuleContext } from "../types";

function CompetitorAdsAction({ item, controller }: StepModuleContext) {
  const { clientId, busy, toggleManual, initialData } = controller;
  const [competitorOffers, setCompetitorOffers] = useState<CompetitorOffer[] | null>(
    initialData.competitorOffers,
  );
  const [adsRunning, setAdsRunning] = useState(false);
  const [adsMsg, setAdsMsg] = useState<string | null>(null);

  async function runCompetitorOffers() {
    setAdsRunning(true);
    setAdsMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/competitor-ads`, { method: "POST" });
      const payload = (await res.json()) as { error?: string; competitors?: CompetitorOffer[] };
      if (!res.ok) throw new Error(payload.error ?? "Competitor research failed");
      const offers = payload.competitors ?? [];
      setCompetitorOffers(offers);
      if (offers.length === 0) setAdsMsg("No competitors found — try again or add more context.");
    } catch (e) {
      setAdsMsg(e instanceof Error ? e.message : "Competitor research failed");
    } finally {
      setAdsRunning(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {!competitorOffers ? (
        <button
          type="button"
          disabled={adsRunning}
          onClick={() => void runCompetitorOffers()}
          className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {adsRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {adsRunning ? "Researching…" : "Research competitor offers"}
        </button>
      ) : competitorOffers.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-bip-border bg-bip-fill p-3">
          {competitorOffers.map((c, i) => (
            <div key={i} className="border-t border-bip-border pt-2.5 first:border-t-0 first:pt-0">
              <p className="text-xs font-medium text-bip-text">{c.name}</p>
              {c.offers && <p className="mt-0.5 text-[11px] text-bip-muted"><span className="text-bip-text">Offers:</span> {c.offers}</p>}
              {c.positioning && <p className="text-[11px] text-bip-muted"><span className="text-bip-text">Positioning:</span> {c.positioning}</p>}
              {c.counter && <p className="text-[11px] text-bip-muted"><span className="text-bip-text">Counter:</span> {c.counter}</p>}
            </div>
          ))}
          <button
            type="button"
            disabled={adsRunning}
            onClick={() => void runCompetitorOffers()}
            className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-60"
          >
            {adsRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-run
          </button>
        </div>
      ) : null}
      {adsMsg && <p className="text-xs text-bip-muted">{adsMsg}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggleManual(item.itemKey, !item.done)}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
      >
        <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
      </button>
    </div>
  );
}

function CampaignPlanAction({ item, controller }: StepModuleContext) {
  const { clientId, busy, toggleManual, initialData } = controller;
  const [campaignPlan, setCampaignPlan] = useState<CampaignPlan | null>(initialData.campaignPlan);
  const [planRunning, setPlanRunning] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);

  async function runCampaignPlan() {
    setPlanRunning(true);
    setPlanMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/campaign-plan`, { method: "POST" });
      const payload = (await res.json()) as { error?: string; plan?: CampaignPlan };
      if (!res.ok || !payload.plan) throw new Error(payload.error ?? "Campaign plan draft failed");
      setCampaignPlan(payload.plan);
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Campaign plan draft failed");
    } finally {
      setPlanRunning(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {!campaignPlan ? (
        <button
          type="button"
          disabled={planRunning}
          onClick={() => void runCampaignPlan()}
          className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {planRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {planRunning ? "Drafting…" : "Draft campaign plan"}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-bip-border bg-bip-fill p-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Ad groups</p>
            <div className="mt-1 space-y-1.5">
              {campaignPlan.adGroups.map((g, i) => (
                <div key={i}>
                  <p className="text-xs font-medium text-bip-text">{g.name}</p>
                  <p className="text-[11px] text-bip-muted">{g.keywords.join(" · ")}</p>
                </div>
              ))}
            </div>
          </div>
          {campaignPlan.budgetNotes && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Budget</p>
              <p className="mt-0.5 text-[11px] text-bip-muted">{campaignPlan.budgetNotes}</p>
            </div>
          )}
          {campaignPlan.negatives.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Negative keywords ({campaignPlan.negatives.length})</p>
              <p className="mt-0.5 text-[11px] text-bip-muted">{campaignPlan.negatives.join(", ")}</p>
            </div>
          )}
          <button
            type="button"
            disabled={planRunning}
            onClick={() => void runCampaignPlan()}
            className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-60"
          >
            {planRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-draft
          </button>
        </div>
      )}
      {planMsg && <p className="text-xs text-bip-muted">{planMsg}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggleManual(item.itemKey, !item.done)}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
      >
        <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
      </button>
    </div>
  );
}

export const CompetitorAdsStep: StepModule = {
  match: (v) => v === "manual:ppc_competitors",
  Action: CompetitorAdsAction,
};

export const CampaignPlanStep: StepModule = {
  match: (v) => v === "manual:ppc_campaign",
  Action: CampaignPlanAction,
};
