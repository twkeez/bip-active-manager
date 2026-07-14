"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";

type SopStep = {
  item_key: string;
  label: string;
  category: string;
  phase: string;
  severity: string;
  sort_order: number;
  guidance: string | null;
};

const PHASE_LABEL: Record<string, string> = {
  foundation: "Foundation",
  at_launch: "At launch",
};

export default function OnboardingSopEditor() {
  const [steps, setSteps] = useState<SopStep[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/onboarding/sops", { cache: "no-store" });
        const payload = (await res.json()) as { error?: string; steps?: SopStep[] };
        if (cancelled) return;
        if (!res.ok || !payload.steps) throw new Error(payload.error ?? "Failed to load SOPs");
        setSteps(payload.steps);
        setDrafts(Object.fromEntries(payload.steps.map((s) => [s.item_key, s.guidance ?? ""])));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load SOPs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = steps.some((s) => (drafts[s.item_key] ?? "") !== (s.guidance ?? ""));

  async function saveAll() {
    setSaving(true);
    setError(null);
    try {
      const items = steps
        .filter((s) => (drafts[s.item_key] ?? "") !== (s.guidance ?? ""))
        .map((s) => ({ item_key: s.item_key, guidance: drafts[s.item_key] ?? "" }));
      if (items.length === 0) return;
      const res = await fetch("/api/onboarding/sops", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const payload = (await res.json()) as { error?: string; steps?: SopStep[] };
      if (!res.ok || !payload.steps) throw new Error(payload.error ?? "Failed to save");
      setSteps(payload.steps);
      setDrafts(Object.fromEntries(payload.steps.map((s) => [s.item_key, s.guidance ?? ""])));
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-bip-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading SOPs…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-3 border-b border-bip-border bg-bip-card px-1 py-2">
        <p className="text-xs text-bip-muted">
          {steps.length} steps · edits apply to new and in-progress clients.
        </p>
        <div className="flex items-center gap-2">
          {savedAt && !dirty && <span className="text-xs text-emerald-500">Saved</span>}
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => void saveAll()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-bip-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.item_key} className="rounded-xl border border-bip-border bg-bip-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-bip-text">{step.label}</span>
              <span className="rounded-full bg-bip-fill px-2 py-0.5 text-[11px] text-bip-muted">
                {PHASE_LABEL[step.phase] ?? step.phase}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-bip-subtle">{step.category}</span>
            </div>
            <textarea
              value={drafts[step.item_key] ?? ""}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [step.item_key]: e.target.value }))}
              placeholder="Write the SOP for this step…"
              className="min-h-[120px] w-full rounded-lg bip-input font-mono text-sm leading-relaxed shadow-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
