"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, RotateCcw, Save } from "lucide-react";

type Props = { clientId: number };

type KickoffResponse = {
  title: string;
  body: string;
  defaultTitle: string;
  defaultBody: string;
  isOverride: boolean;
  error?: string;
};

export default function OnboardingKickoffPanel({ clientId }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [defaults, setDefaults] = useState<{ title: string; body: string }>({ title: "", body: "" });
  const [isOverride, setIsOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"title" | "body" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/onboarding/kickoff`, { cache: "no-store" });
        const payload = (await response.json()) as KickoffResponse;
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error ?? "Failed to load kickoff");
        setTitle(payload.title);
        setBody(payload.body);
        setDefaults({ title: payload.defaultTitle, body: payload.defaultBody });
        setIsOverride(payload.isOverride);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load kickoff");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function copy(which: "title" | "body") {
    try {
      await navigator.clipboard.writeText(which === "title" ? title : body);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/kickoff`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to save");
      setIsOverride(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setError(null);
    try {
      await fetch(`/api/clients/${clientId}/onboarding/kickoff`, { method: "DELETE" });
      setTitle(defaults.title);
      setBody(defaults.body);
      setIsOverride(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-bip-border bg-bip-card p-3 text-sm text-bip-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading kickoff message…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-bip-border bg-bip-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">Basecamp kickoff message</p>
        {isOverride && <span className="rounded-full bg-bip-fill px-2 py-0.5 text-[10px] text-bip-muted">edited for this client</span>}
      </div>
      <p className="mb-2 text-[11px] text-bip-muted">
        Start one Basecamp thread per quarter with this title and message. Edit as needed, then copy &amp; paste — this never posts to Basecamp for you.
      </p>

      {/* Title */}
      <label className="text-[11px] font-medium text-bip-muted">Thread title</label>
      <div className="mb-2 mt-1 flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm text-bip-text focus:border-bip-accent focus:outline-none"
        />
        <button type="button" onClick={() => void copy("title")} className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1.5 text-xs text-bip-text hover:bg-bip-fill">
          {copied === "title" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} Copy
        </button>
      </div>

      {/* Body */}
      <label className="text-[11px] font-medium text-bip-muted">Message</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="mt-1 min-h-64 w-full rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm leading-relaxed text-bip-text focus:border-bip-accent focus:outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void copy("body")} className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
          {copied === "body" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy message
        </button>
        <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill disabled:opacity-60">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save for this client
        </button>
        <button type="button" disabled={saving} onClick={() => void reset()} className="inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-muted hover:bg-bip-fill disabled:opacity-60">
          <RotateCcw className="h-3.5 w-3.5" /> Reset to default
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
