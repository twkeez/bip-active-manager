"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import type { PartnershipContent } from "@/lib/services/partnership-content";

const TIER_LABELS = ["Foundation", "Premium", "Premium Plus"];
const FIELD =
  "w-full rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none";

type Props = {
  initial: PartnershipContent;
  onSaved: (content: PartnershipContent) => void;
  onCancel: () => void;
};

export default function PartnershipEditor({ initial, onSaved, onCancel }: Props) {
  const [c, setC] = useState<PartnershipContent>(() => structuredClone(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(mut: (draft: PartnershipContent) => void) {
    setC((prev) => {
      const next = structuredClone(prev);
      mut(next);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const cleaned = structuredClone(c);
    cleaned.partnerRows = cleaned.partnerRows.map((r) => ({ ...r, note: r.note?.trim() ? r.note.trim() : undefined }));
    try {
      const res = await fetch("/api/services/content/partnership", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: cleaned }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to save");
      onSaved(cleaned);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <label className="block text-[11px] text-bip-muted">
        Intro
        <textarea className={`${FIELD} mt-1 min-h-16`} value={c.intro} onChange={(e) => update((d) => { d.intro = e.target.value; })} />
      </label>

      {/* Partner table rows */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">How we partner — rows</p>
        <div className="space-y-3">
          {c.partnerRows.map((row, ri) => (
            <div key={ri} className="rounded-lg border border-bip-border bg-bip-page/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${FIELD} max-w-xs`} value={row.label} placeholder="Row label" onChange={(e) => update((d) => { d.partnerRows[ri].label = e.target.value; })} />
                <input className={`${FIELD} max-w-xs`} value={row.note ?? ""} placeholder="Note (optional)" onChange={(e) => update((d) => { d.partnerRows[ri].note = e.target.value; })} />
                <button type="button" onClick={() => update((d) => { d.partnerRows.splice(ri, 1); })} className="ml-auto inline-flex items-center gap-1 rounded border border-bip-border px-2 py-1 text-xs text-bip-muted hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {TIER_LABELS.map((tl, ci) => (
                  <label key={ci} className="text-[11px] text-bip-muted">
                    {tl}
                    <textarea className={`${FIELD} mt-1 min-h-16`} value={row.cells[ci]} onChange={(e) => update((d) => { d.partnerRows[ri].cells[ci] = e.target.value; })} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => update((d) => { d.partnerRows.push({ label: "New row", cells: ["", "", ""] }); })} className="mt-3 inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill">
          <Plus className="h-3.5 w-3.5" /> Add row
        </button>
      </section>

      {/* On-demand */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">On-demand / à-la-carte</p>
        <label className="block text-[11px] text-bip-muted">Intro
          <textarea className={`${FIELD} mt-1`} value={c.onDemand.intro} onChange={(e) => update((d) => { d.onDemand.intro = e.target.value; })} />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] text-bip-muted">Client rate
            <input className={`${FIELD} mt-1`} value={c.onDemand.clientRate} onChange={(e) => update((d) => { d.onDemand.clientRate = e.target.value; })} />
          </label>
          <label className="text-[11px] text-bip-muted">Client billing
            <input className={`${FIELD} mt-1`} value={c.onDemand.clientBilling} onChange={(e) => update((d) => { d.onDemand.clientBilling = e.target.value; })} />
          </label>
          <label className="text-[11px] text-bip-muted">Non-client rate
            <input className={`${FIELD} mt-1`} value={c.onDemand.nonClientRate} onChange={(e) => update((d) => { d.onDemand.nonClientRate = e.target.value; })} />
          </label>
          <label className="text-[11px] text-bip-muted">Non-client billing
            <input className={`${FIELD} mt-1`} value={c.onDemand.nonClientBilling} onChange={(e) => update((d) => { d.onDemand.nonClientBilling = e.target.value; })} />
          </label>
        </div>
        <label className="block text-[11px] text-bip-muted">How it works
          <textarea className={`${FIELD} mt-1 min-h-20`} value={c.onDemand.howItWorks} onChange={(e) => update((d) => { d.onDemand.howItWorks = e.target.value; })} />
        </label>
      </section>

      {/* Boundary lines */}
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">Boundary lines</p>
        <div className="space-y-3">
          {c.boundaryLines.map((b, i) => (
            <div key={i} className="rounded-lg border border-bip-border bg-bip-page/40 p-3">
              <div className="flex items-center gap-2">
                <input className={`${FIELD}`} value={b.when} placeholder="When (situation)" onChange={(e) => update((d) => { d.boundaryLines[i].when = e.target.value; })} />
                <button type="button" onClick={() => update((d) => { d.boundaryLines.splice(i, 1); })} className="rounded p-1 text-bip-muted hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
              <textarea className={`${FIELD} mt-2 min-h-16`} value={b.say} placeholder="What to say" onChange={(e) => update((d) => { d.boundaryLines[i].say = e.target.value; })} />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => update((d) => { d.boundaryLines.push({ when: "New situation", say: "" }); })} className="mt-3 inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill">
          <Plus className="h-3.5 w-3.5" /> Add line
        </button>
      </section>

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-bip-border bg-bip-page/95 py-3 backdrop-blur">
        <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#ce2084" }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-3 py-2 text-sm text-bip-text hover:bg-bip-fill">
          <X className="h-4 w-4" /> Cancel
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
