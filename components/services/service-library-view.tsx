"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Link2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import {
  SERVICE_LIBRARY_CATEGORIES,
  type ServiceLibraryItem,
} from "@/lib/services/library-types";

const MAGENTA = "#ce2084";

export default function ServiceLibraryView({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<ServiceLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [category, setCategory] = useState<string>(SERVICE_LIBRARY_CATEGORIES[0]);
  const [savingLink, setSavingLink] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/services/library", { cache: "no-store" });
        const payload = (await res.json()) as { error?: string; items?: ServiceLibraryItem[] };
        if (cancelled) return;
        if (!res.ok || !payload.items) throw new Error(payload.error ?? "Failed to load library");
        setItems(payload.items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load library");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addLink() {
    const label = linkLabel.trim();
    const url = linkUrl.trim();
    if (!label || !url) return;
    setSavingLink(true);
    setError(null);
    try {
      const res = await fetch("/api/services/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "link", label, url, category }),
      });
      const payload = (await res.json()) as { error?: string; item?: ServiceLibraryItem };
      if (!res.ok || !payload.item) throw new Error(payload.error ?? "Failed to add link");
      setItems((prev) => [...prev, payload.item!]);
      setLinkLabel("");
      setLinkUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add link");
    } finally {
      setSavingLink(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("label", file.name);
      fd.append("category", category);
      const res = await fetch("/api/services/library/upload", { method: "POST", body: fd });
      const payload = (await res.json()) as { error?: string; item?: ServiceLibraryItem };
      if (!res.ok || !payload.item) throw new Error(payload.error ?? "Failed to upload file");
      setItems((prev) => [...prev, payload.item!]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function openFile(id: number) {
    try {
      const res = await fetch(`/api/services/library/${id}/download`, { cache: "no-store" });
      const payload = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !payload.url) throw new Error(payload.error ?? "Couldn't open that file.");
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open that file.");
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      const res = await fetch(`/api/services/library/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete");
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  const categories = [...new Set([...SERVICE_LIBRARY_CATEGORIES, ...items.map((i) => i.category)])];
  const grouped = categories
    .map((cat) => ({ cat, list: items.filter((i) => i.category === cat) }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="space-y-5">
      {/* Admin: add link / upload */}
      {isAdmin && (
        <div className="rounded-xl border border-bip-border bg-bip-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: MAGENTA }}>
            Add to the library
          </p>
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-bip-muted">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 block rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text"
              >
                {SERVICE_LIBRARY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-bip-muted">
              Label
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="e.g. Brand guide"
                className="mt-1 block w-48 rounded-md border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm text-bip-text"
              />
            </label>
            <label className="text-xs text-bip-muted">
              Link URL
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://docs.google.com/…"
                className="mt-1 block w-64 rounded-md border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm text-bip-text"
              />
            </label>
            <button
              type="button"
              disabled={savingLink || !linkLabel.trim() || !linkUrl.trim()}
              onClick={() => void addLink()}
              className="inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-sm text-bip-text hover:bg-bip-fill disabled:opacity-50"
            >
              {savingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add link
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: MAGENTA }}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Uploading…" : "Upload file"}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      )}

      {error && <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-bip-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading library…
        </div>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-bip-muted">
          Nothing in the library yet.{isAdmin ? " Add a link or upload a file above." : ""}
        </p>
      ) : (
        grouped.map(({ cat, list }) => (
          <section key={cat} className="rounded-xl border border-bip-border bg-bip-card overflow-hidden">
            <div className="border-b border-bip-border bg-bip-page px-4 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-bip-muted">{cat}</h3>
            </div>
            <ul className="divide-y divide-bip-border">
              {list.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  {item.kind === "link" ? (
                    <Link2 className="h-4 w-4 shrink-0" style={{ color: MAGENTA }} />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0" style={{ color: MAGENTA }} />
                  )}
                  <div className="min-w-0 flex-1">
                    {item.kind === "link" ? (
                      <a href={item.url ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-bip-text hover:underline">
                        {item.label} <ExternalLink className="h-3 w-3 text-bip-muted" />
                      </a>
                    ) : (
                      <button type="button" onClick={() => void openFile(item.id)} className="text-left text-sm text-bip-text hover:underline">
                        {item.label}
                      </button>
                    )}
                  </div>
                  {isAdmin && (
                    <button type="button" onClick={() => void remove(item.id)} className="rounded p-1 text-bip-muted hover:text-red-500" aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
