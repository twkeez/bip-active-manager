"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

type Entry = {
  key: string;
  label: string;
  category: string;
  content: string | null;
  sort_order: number;
};

export default function BestPracticesEditor() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/best-practices", { cache: "no-store" });
        const payload = (await res.json()) as { error?: string; entries?: Entry[] };
        if (cancelled) return;
        if (!res.ok || !payload.entries) throw new Error(payload.error ?? "Failed to load");
        setEntries(payload.entries);
        setDrafts(Object.fromEntries(payload.entries.map((e) => [e.key, e.content ?? ""])));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = entries.some((e) => (drafts[e.key] ?? "") !== (e.content ?? ""));

  async function saveAll() {
    setSaving(true);
    setError(null);
    try {
      const items = entries
        .filter((e) => (drafts[e.key] ?? "") !== (e.content ?? ""))
        .map((e) => ({ key: e.key, content: drafts[e.key] ?? "" }));
      if (items.length === 0) return;
      const res = await fetch("/api/best-practices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: items }),
      });
      const payload = (await res.json()) as { error?: string; entries?: Entry[] };
      if (!res.ok || !payload.entries) throw new Error(payload.error ?? "Failed to save");
      setEntries(payload.entries);
      setDrafts(Object.fromEntries(payload.entries.map((e) => [e.key, e.content ?? ""])));
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
        <Loader2 className="h-4 w-4 animate-spin" /> Loading best practices…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-3 border-b border-bip-border bg-bip-card px-1 py-2">
        <p className="text-xs text-bip-muted">
          Your constants — the onboarding assists combine these with AI for the variances.
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
        {entries.map((entry) => (
          <div key={entry.key} className="rounded-xl border border-bip-border bg-bip-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-bip-text">{entry.label}</span>
              <span className="rounded-full bg-bip-fill px-2 py-0.5 text-[11px] text-bip-muted">{entry.category}</span>
            </div>
            <textarea
              value={drafts[entry.key] ?? ""}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [entry.key]: e.target.value }))}
              className="min-h-[140px] w-full rounded-lg bip-input font-mono text-sm leading-relaxed shadow-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
