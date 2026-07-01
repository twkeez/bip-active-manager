"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import type { ServiceTierTable } from "@/lib/services/tier-content";

const TIER_LABELS = ["Foundation", "Premium", "Premium Plus"];
const FIELD =
  "w-full rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none";

type Props = {
  initial: ServiceTierTable[];
  onSaved: (tables: ServiceTierTable[]) => void;
  onCancel: () => void;
};

export default function ServiceTiersEditor({ initial, onSaved, onCancel }: Props) {
  const [tables, setTables] = useState<ServiceTierTable[]>(() => structuredClone(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(mut: (draft: ServiceTierTable[]) => void) {
    setTables((prev) => {
      const next = structuredClone(prev);
      mut(next);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    // Drop empty bullet lines and blank notes before saving.
    const cleaned: ServiceTierTable[] = structuredClone(tables).map((t) => ({
      ...t,
      rows: t.rows.map((r) => ({
        ...r,
        note: r.note?.trim() ? r.note.trim() : undefined,
        cells: r.cells.map((c) => c.map((b) => b.trim()).filter(Boolean)) as string[][],
      })),
    }));
    try {
      const res = await fetch("/api/services/content/tiers", {
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
      <p className="text-xs text-bip-muted">
        Edit any wording below. In a tier cell, put <strong className="text-bip-text">one bullet per line</strong>. Add or remove
        comparison rows as needed. (Which services and tiers exist stays fixed.)
      </p>

      {tables.map((table, ti) => (
        <section key={table.key} className="rounded-xl border border-bip-border bg-bip-card p-4">
          <p className="text-sm font-semibold text-bip-text">{table.label}</p>
          <label className="mt-2 block text-[11px] text-bip-muted">
            Summary
            <textarea
              className={`${FIELD} mt-1 min-h-16`}
              value={table.summary}
              onChange={(e) => update((d) => { d[ti].summary = e.target.value; })}
            />
          </label>

          <div className="mt-3 space-y-3">
            {table.rows.map((row, ri) => (
              <div key={ri} className="rounded-lg border border-bip-border bg-bip-page/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className={`${FIELD} max-w-xs`}
                    value={row.label}
                    placeholder="Row label"
                    onChange={(e) => update((d) => { d[ti].rows[ri].label = e.target.value; })}
                  />
                  <input
                    className={`${FIELD} max-w-xs`}
                    value={row.note ?? ""}
                    placeholder="Note / callout (optional)"
                    onChange={(e) => update((d) => { d[ti].rows[ri].note = e.target.value; })}
                  />
                  <button
                    type="button"
                    onClick={() => update((d) => { d[ti].rows.splice(ri, 1); })}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-bip-border px-2 py-1 text-xs text-bip-muted hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove row
                  </button>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {TIER_LABELS.map((tl, ci) => (
                    <label key={ci} className="text-[11px] text-bip-muted">
                      {tl}
                      <textarea
                        className={`${FIELD} mt-1 min-h-24`}
                        value={row.cells[ci].join("\n")}
                        placeholder="One bullet per line"
                        onChange={(e) => update((d) => { d[ti].rows[ri].cells[ci] = e.target.value.split("\n"); })}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => update((d) => { d[ti].rows.push({ label: "New row", cells: [[], [], []] }); })}
            className="mt-3 inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
          >
            <Plus className="h-3.5 w-3.5" /> Add row
          </button>
        </section>
      ))}

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-bip-border bg-bip-page/95 py-3 backdrop-blur">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "#ce2084" }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-3 py-2 text-sm text-bip-text hover:bg-bip-fill"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
