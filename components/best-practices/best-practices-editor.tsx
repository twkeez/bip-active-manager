"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Search } from "lucide-react";

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
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
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

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? entries.filter(
          (e) => e.label.toLowerCase().includes(q) || (e.content ?? "").toLowerCase().includes(q),
        )
      : entries;
    const map = new Map<string, Entry[]>();
    for (const e of filtered) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return [...map.entries()];
  }, [entries, query]);

  function toggleEdit(key: string) {
    setEditing((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 border-b border-bip-border bg-bip-card px-1 py-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-bip-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — “expected CTR”, “budget”, “negatives”…"
            className="w-full rounded-lg bip-input pl-8 text-sm shadow-none"
          />
        </div>
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

      {groups.length === 0 && <p className="py-8 text-center text-sm text-bip-muted">No entries match “{query}”.</p>}

      {groups.map(([category, list]) => (
        <section key={category}>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">{category}</h2>
          <div className="space-y-3">
            {list.map((entry) => {
              const isEditing = editing.has(entry.key);
              const isDirty = (drafts[entry.key] ?? "") !== (entry.content ?? "");
              return (
                <div key={entry.key} className="rounded-xl border border-bip-border bg-bip-card p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-bip-text">{entry.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleEdit(entry.key)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-bip-border px-2 py-0.5 text-[11px] text-bip-muted hover:bg-bip-fill"
                    >
                      <Pencil className="h-3 w-3" /> {isEditing ? "Done" : "Edit"}
                      {isDirty && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />}
                    </button>
                  </div>
                  {isEditing ? (
                    <textarea
                      value={drafts[entry.key] ?? ""}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [entry.key]: e.target.value }))}
                      className="min-h-[220px] w-full rounded-lg bip-input font-mono text-sm leading-relaxed shadow-none"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-bip-muted">
                      {drafts[entry.key]?.trim() ? drafts[entry.key] : <span className="italic">Empty — click Edit to add.</span>}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
