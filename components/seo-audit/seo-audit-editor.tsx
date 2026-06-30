"use client";

import { useState } from "react";
import { Check, Download, Loader2, Plus, Trash2 } from "lucide-react";
import type {
  AuditRating,
  RecommendationPriority,
  SeoAuditTemplateData,
} from "@/lib/site-audit/seo-audit-template";
import { MANUAL_ITEM_KEYS } from "@/lib/site-audit/seo-audit-template";
import type { ClientSeoAudit } from "@/lib/site-audit/seo-audit-types";

type Props = {
  audit: ClientSeoAudit;
  onSaved?: (audit: ClientSeoAudit) => void;
};

const RATING_OPTIONS: Array<{ value: AuditRating; label: string; active: string }> = [
  { value: "good", label: "Good", active: "border-emerald-500 bg-emerald-500/15 text-emerald-300" },
  { value: "needs_work", label: "Needs Work", active: "border-amber-500 bg-amber-500/15 text-amber-300" },
  { value: "critical", label: "Critical", active: "border-red-500 bg-red-500/15 text-red-300" },
];

const PRIORITY_OPTIONS: RecommendationPriority[] = ["high", "med", "low"];
const TIERS = ["Foundation", "Premium", "Premium Plus"] as const;

const FIELD =
  "w-full rounded-lg border border-bip-border bg-bip-card/85 px-3 py-2 text-sm text-bip-text focus:border-bip-accent focus:outline-none";

export default function SeoAuditEditor({ audit, onSaved }: Props) {
  const [data, setData] = useState<SeoAuditTemplateData>(audit.template_json);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function update(mutator: (draft: SeoAuditTemplateData) => void) {
    setData((prev) => {
      const next = structuredClone(prev);
      mutator(next);
      return next;
    });
    setSavedAt(null);
  }

  async function persist(status?: "draft" | "completed") {
    const isComplete = status === "completed";
    if (isComplete) setCompleting(true);
    else setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/client-seo-audits/${audit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateJson: data, ...(status ? { status } : {}) }),
      });
      const payload = (await response.json()) as { error?: string; audit?: ClientSeoAudit };
      if (!response.ok || !payload.audit) throw new Error(payload.error ?? "Failed to save audit");
      setSavedAt(new Date().toLocaleTimeString());
      onSaved?.(payload.audit);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save audit");
    } finally {
      setSaving(false);
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Meta */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-bip-muted">Audit details</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-bip-muted">Client
            <input className={FIELD} value={data.meta.client} onChange={(e) => update((d) => { d.meta.client = e.target.value; })} />
          </label>
          <label className="text-xs text-bip-muted">Website
            <input className={FIELD} value={data.meta.website} onChange={(e) => update((d) => { d.meta.website = e.target.value; })} />
          </label>
          <label className="text-xs text-bip-muted">Audit date
            <input type="date" className={FIELD} value={data.meta.auditDate} onChange={(e) => update((d) => { d.meta.auditDate = e.target.value; })} />
          </label>
          <label className="text-xs text-bip-muted">Prepared by
            <input className={FIELD} value={data.meta.preparedBy} onChange={(e) => update((d) => { d.meta.preparedBy = e.target.value; })} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-bip-muted">Package tier:</span>
          {TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => update((d) => { d.meta.packageTier = d.meta.packageTier === tier ? null : tier; })}
              className={`rounded-full border px-3 py-1 text-xs ${data.meta.packageTier === tier ? "border-bip-accent bg-bip-accent/15 text-bip-text" : "border-bip-border text-bip-muted hover:bg-bip-fill"}`}
            >
              {tier}
            </button>
          ))}
        </div>
      </section>

      {/* 01 Executive summary */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <p className="mb-2 text-sm font-semibold text-bip-text">01 — Executive Summary</p>
        <textarea className={`${FIELD} min-h-24`} value={data.executiveSummary} placeholder="3–5 sentence overview…" onChange={(e) => update((d) => { d.executiveSummary = e.target.value; })} />
        <p className="mb-1 mt-3 text-xs font-medium text-bip-muted">Top 3 priorities</p>
        {data.topPriorities.map((priority, idx) => (
          <input
            key={idx}
            className={`${FIELD} mb-2`}
            placeholder={`Priority ${idx + 1}`}
            value={priority}
            onChange={(e) => update((d) => { d.topPriorities[idx] = e.target.value; })}
          />
        ))}
      </section>

      {/* 02–06 rated sections */}
      {data.ratedSections.map((section, sIdx) => (
        <section key={section.id} className="rounded-xl border border-bip-border bg-bip-card p-4">
          <p className="text-sm font-semibold text-bip-text">{section.number} — {section.title}</p>
          <p className="mb-3 text-xs text-bip-muted">{section.intro}</p>
          <div className="space-y-2">
            {section.items.map((item, iIdx) => (
              <div key={item.key} className="grid gap-2 rounded-lg border border-bip-border bg-bip-page/40 p-2 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="text-sm text-bip-text">
                    {item.label}
                    {MANUAL_ITEM_KEYS.has(item.key) && <span className="ml-2 rounded bg-bip-fill px-1.5 py-0.5 text-[10px] text-bip-muted">manual</span>}
                  </p>
                  <input
                    className={`${FIELD} mt-1`}
                    placeholder="Notes…"
                    value={item.notes}
                    onChange={(e) => update((d) => { d.ratedSections[sIdx].items[iIdx].notes = e.target.value; })}
                  />
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  {RATING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update((d) => {
                        const cur = d.ratedSections[sIdx].items[iIdx];
                        cur.rating = cur.rating === opt.value ? null : opt.value;
                      })}
                      className={`rounded-md border px-2 py-1 text-[11px] ${item.rating === opt.value ? opt.active : "border-bip-border text-bip-muted hover:bg-bip-fill"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* 07 Content */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <p className="mb-2 text-sm font-semibold text-bip-text">07 — Structure & Content Opportunities</p>
        <textarea className={`${FIELD} min-h-20`} value={data.contentOpportunities} placeholder="Content gaps, pages that should exist…" onChange={(e) => update((d) => { d.contentOpportunities = e.target.value; })} />
      </section>

      {/* 08 Keywords & competitors */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <p className="mb-2 text-sm font-semibold text-bip-text">08 — Keywords & Competitors</p>
        <label className="text-xs text-bip-muted">Target keywords
          <input className={FIELD} value={data.keywords.targetKeywords} onChange={(e) => update((d) => { d.keywords.targetKeywords = e.target.value; })} />
        </label>
        <p className="mb-1 mt-3 text-xs font-medium text-bip-muted">Top 3 competitors</p>
        {data.keywords.competitors.map((comp, idx) => (
          <input key={idx} className={`${FIELD} mb-2`} placeholder={`Competitor ${idx + 1}`} value={comp} onChange={(e) => update((d) => { d.keywords.competitors[idx] = e.target.value; })} />
        ))}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(["strengths", "weaknesses", "opportunities", "threats"] as const).map((key) => (
            <label key={key} className="text-xs capitalize text-bip-muted">{key}
              <textarea className={`${FIELD} min-h-16`} value={data.keywords.swot[key]} onChange={(e) => update((d) => { d.keywords.swot[key] = e.target.value; })} />
            </label>
          ))}
        </div>
      </section>

      {/* 09 Recommendations */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-bip-text">09 — Recommendations & Next Steps</p>
          <button type="button" onClick={() => update((d) => { d.recommendations.push({ recommendation: "", priority: "med", owner: "" }); })} className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-text hover:bg-bip-fill">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {data.recommendations.length === 0 && <p className="text-xs text-bip-muted">No recommendations yet.</p>}
        <div className="space-y-2">
          {data.recommendations.map((rec, idx) => (
            <div key={idx} className="grid gap-2 rounded-lg border border-bip-border bg-bip-page/40 p-2 sm:grid-cols-[1fr_auto_auto]">
              <input className={FIELD} placeholder="Recommendation" value={rec.recommendation} onChange={(e) => update((d) => { d.recommendations[idx].recommendation = e.target.value; })} />
              <div className="flex items-center gap-1">
                {PRIORITY_OPTIONS.map((p) => (
                  <button key={p} type="button" onClick={() => update((d) => { d.recommendations[idx].priority = d.recommendations[idx].priority === p ? null : p; })} className={`rounded-md border px-2 py-1 text-[11px] uppercase ${rec.priority === p ? "border-bip-accent bg-bip-accent/15 text-bip-text" : "border-bip-border text-bip-muted hover:bg-bip-fill"}`}>{p}</button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <input className={`${FIELD} w-32`} placeholder="Owner" value={rec.owner} onChange={(e) => update((d) => { d.recommendations[idx].owner = e.target.value; })} />
                <button type="button" onClick={() => update((d) => { d.recommendations.splice(idx, 1); })} className="rounded p-1 text-bip-muted hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-bip-border bg-bip-page/95 py-3 backdrop-blur">
        <button type="button" disabled={saving} onClick={() => void persist()} className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
        </button>
        <a href={`/api/client-seo-audits/${audit.id}/word`} className="inline-flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card px-3 py-2 text-sm font-medium text-bip-text hover:bg-bip-fill">
          <Download className="h-4 w-4" /> Download Word
        </a>
        <button type="button" disabled={completing} onClick={() => void persist("completed")} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60">
          {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Mark completed
        </button>
        {savedAt && <span className="text-xs text-bip-muted">Saved {savedAt}</span>}
        {audit.status === "completed" && <span className="text-xs text-emerald-400">Completed</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
