"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import type { ClientOnboardingEvaluation } from "@/lib/clients/types";
import { WebsiteField } from "../shared";
import type { KeywordData, StepModule, StepModuleContext } from "../types";

function KeywordsAction({ controller }: StepModuleContext) {
  const { clientId, setError, setEvaluation } = controller;
  const [keywordData, setKeywordData] = useState<KeywordData | null>(null);
  const [keywordSelected, setKeywordSelected] = useState<string[]>([]);
  const [keywordSaving, setKeywordSaving] = useState(false);

  // Load the keyword plan (allowance + suggestions + current) when the step opens.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/onboarding/keywords`, { cache: "no-store" });
        const payload = (await res.json()) as KeywordData & { error?: string };
        if (cancelled || !res.ok) return;
        setKeywordData({
          allowance: payload.allowance,
          candidates: payload.candidates ?? [],
          existing: payload.existing ?? [],
        });
        setKeywordSelected(payload.existing ?? []);
      } catch {
        // ignore — the step still works, just without pre-fill
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function toggleKeyword(keyword: string) {
    setKeywordSelected((prev) => {
      if (prev.includes(keyword)) return prev.filter((k) => k !== keyword);
      if (keywordData && prev.length >= keywordData.allowance) return prev; // capped
      return [...prev, keyword];
    });
  }

  async function saveKeywords() {
    setKeywordSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: keywordSelected }),
      });
      const payload = (await res.json()) as {
        error?: string;
        evaluation?: ClientOnboardingEvaluation;
        saved?: string[];
      };
      if (!res.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to save keywords");
      setEvaluation(payload.evaluation);
      const saved = payload.saved ?? [];
      setKeywordData((d) => (d ? { ...d, existing: saved } : d));
      setKeywordSelected(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save keywords");
    } finally {
      setKeywordSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {!keywordData ? (
        <span className="text-xs text-bip-muted">Researching keywords…</span>
      ) : keywordData.allowance === 0 ? (
        <p className="text-xs text-bip-muted">No keyword tracking at this tier.</p>
      ) : (
        <>
          <p className="text-[11px] text-bip-muted">
            Pick up to {keywordData.allowance} — sorted by monthly search volume in the practice city.
            <span className="ml-1 font-medium text-bip-text">{keywordSelected.length}/{keywordData.allowance} selected</span>
          </p>
          <div className="space-y-1">
            {keywordData.candidates.map((c) => {
              const checked = keywordSelected.includes(c.keyword);
              const capped = !checked && keywordSelected.length >= keywordData.allowance;
              return (
                <label
                  key={c.keyword}
                  className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 ${checked ? "border-bip-accent bg-bip-fill" : "border-bip-border"} ${capped ? "opacity-50" : "cursor-pointer"}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={capped}
                      onChange={() => toggleKeyword(c.keyword)}
                    />
                    <span className="truncate text-xs text-bip-text">{c.keyword}</span>
                  </span>
                  <span className="shrink-0 text-xs text-bip-muted">
                    {c.volume == null ? "—" : `${c.volume.toLocaleString()}/mo`}
                  </span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            disabled={keywordSaving}
            onClick={() => void saveKeywords()}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {keywordSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save as tracked
          </button>
        </>
      )}
    </div>
  );
}

function SiteAuditAction({ controller }: StepModuleContext) {
  const { clientId, clientProfile, setEvaluation } = controller;
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditMsg, setAuditMsg] = useState<string | null>(null);

  async function runAudit() {
    setAuditRunning(true);
    setAuditMsg(null);
    try {
      const res = await fetch("/api/seo/lighthouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Site audit failed");
      setAuditMsg("Site audit captured.");
      // Re-verify the step (seo_baseline now exists).
      const ob = await fetch(`/api/clients/${clientId}/onboarding`, { cache: "no-store" });
      const obPayload = (await ob.json()) as { evaluation?: ClientOnboardingEvaluation };
      if (obPayload.evaluation) setEvaluation(obPayload.evaluation);
    } catch (e) {
      setAuditMsg(e instanceof Error ? e.message : "Site audit failed");
    } finally {
      setAuditRunning(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {!clientProfile?.website && <WebsiteField controller={controller} />}
      <button
        type="button"
        disabled={auditRunning}
        onClick={() => void runAudit()}
        className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {auditRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Run site audit
      </button>
      {auditMsg && <p className="text-xs text-bip-muted">{auditMsg}</p>}
    </div>
  );
}

function BaselineRankingsAction({ item, controller }: StepModuleContext) {
  const { clientId, clientProfile, busy, toggleManual } = controller;
  const [baselineRunning, setBaselineRunning] = useState(false);
  const [baselineMsg, setBaselineMsg] = useState<string | null>(null);

  async function runBaseline() {
    setBaselineRunning(true);
    setBaselineMsg(null);
    try {
      const res = await fetch("/api/organic-rank/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const payload = (await res.json()) as { error?: string; count?: number };
      if (!res.ok) throw new Error(payload.error ?? "Baseline scan failed");
      setBaselineMsg(`Baseline captured — ${payload.count ?? 0} rankings recorded.`);
    } catch (e) {
      setBaselineMsg(e instanceof Error ? e.message : "Baseline scan failed");
    } finally {
      setBaselineRunning(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {!clientProfile?.website && <WebsiteField controller={controller} />}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={baselineRunning}
          onClick={() => void runBaseline()}
          className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {baselineRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Run baseline rankings
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleManual(item.itemKey, !item.done)}
          className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
        >
          <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
        </button>
      </div>
      {baselineMsg && <p className="text-xs text-bip-muted">{baselineMsg}</p>}
    </div>
  );
}

export const KeywordsStep: StepModule = {
  match: (v) => v === "snapshot:keyword_targets",
  Action: KeywordsAction,
};

export const SiteAuditStep: StepModule = {
  match: (v) => v === "snapshot:seo_baseline",
  Action: SiteAuditAction,
};

export const BaselineRankingsStep: StepModule = {
  match: (v) => v === "manual:baseline_rankings",
  Action: BaselineRankingsAction,
};
