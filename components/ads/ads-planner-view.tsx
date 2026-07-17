"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Sparkles, Target } from "lucide-react";
import { ErrorState } from "@/components/ui/feedback";
import { ToolPage } from "@/components/ui/tool-page";
import type { UrlAdsPlan } from "@/lib/ads/url-ads-plan";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-0.5 text-xs text-bip-text hover:bg-bip-fill"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copied" : label}
    </button>
  );
}

export default function AdsPlannerView() {
  const [url, setUrl] = useState("");
  const [city, setCity] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<UrlAdsPlan | null>(null);
  const [universalCount, setUniversalCount] = useState(0);

  async function run() {
    if (!url.trim()) return;
    setRunning(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/ads-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, city }),
      });
      const payload = (await res.json()) as { plan?: UrlAdsPlan; universalCount?: number; error?: string };
      if (!res.ok || !payload.plan) throw new Error(payload.error ?? "Ads plan failed");
      setPlan(payload.plan);
      setUniversalCount(payload.universalCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ads plan failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <ToolPage
      title="Ads Planner"
      icon={Target}
      maxWidth="4xl"
      description="Feed a practice URL and get a Google Ads starting plan — ad groups, keywords, negatives, and budget notes. Built from the same campaign skeleton and universal negatives in Best Practices that the onboarding planner uses, with AI filling the practice-specific parts."
    >
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-bip-border bg-bip-card p-4">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void run()}
          placeholder="Practice website (example.com)"
          className="min-w-[240px] flex-1 rounded-md bip-input text-sm shadow-none"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (optional)"
          className="w-40 rounded-md bip-input text-sm shadow-none"
        />
        <button
          type="button"
          disabled={running || !url.trim()}
          onClick={() => void run()}
          className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? "Planning…" : "Generate plan"}
        </button>
      </div>

      {running && (
        <p className="text-sm text-bip-muted">Reading the site and drafting the plan — this takes a few seconds.</p>
      )}
      {error && <ErrorState message={error} />}

      {plan && (
        <div className="space-y-5">
          {/* Practice summary */}
          <div className="rounded-xl border border-bip-border bg-bip-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">From the website</p>
            <p className="mt-1 text-sm font-medium text-bip-text">
              {plan.practiceSummary.name || "Practice"}
              {plan.practiceSummary.location ? <span className="text-bip-muted"> · {plan.practiceSummary.location}</span> : null}
            </p>
            {plan.practiceSummary.services && (
              <p className="mt-0.5 text-sm text-bip-muted">{plan.practiceSummary.services}</p>
            )}
          </div>

          {/* Ad groups + keywords */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-bip-text">Ad groups &amp; keywords</h2>
            <div className="space-y-2">
              {plan.adGroups.map((g) => (
                <div key={g.name} className="rounded-xl border border-bip-border bg-bip-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-bip-text">{g.name}</p>
                    <CopyButton text={g.keywords.join("\n")} label="Copy keywords" />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {g.keywords.map((k) => (
                      <span key={k} className="rounded-md bg-bip-fill px-2 py-0.5 text-[11px] text-bip-text">{k}</span>
                    ))}
                  </div>
                </div>
              ))}
              {plan.adGroups.length === 0 && (
                <p className="rounded-xl border border-bip-border bg-bip-card p-3 text-sm text-bip-muted">
                  No ad groups returned — try again, or check the URL is reachable.
                </p>
              )}
            </div>
          </section>

          {/* Negatives */}
          <div className="rounded-xl border border-bip-border bg-bip-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-bip-text">Negative keywords ({plan.negatives.length})</p>
              <CopyButton text={plan.negatives.join("\n")} label="Copy list" />
            </div>
            <p className="mt-1 text-[11px] text-bip-muted">
              Your {universalCount} universal negatives from Best Practices + practice-specific additions.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.negatives.map((n) => (
                <span key={n} className="rounded-md bg-bip-fill px-2 py-0.5 text-[11px] text-bip-muted">{n}</span>
              ))}
            </div>
          </div>

          {/* Budget notes */}
          {plan.budgetNotes && (
            <div className="rounded-xl border border-bip-border bg-bip-card p-4">
              <p className="text-sm font-medium text-bip-text">Budget &amp; priorities</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-bip-muted">{plan.budgetNotes}</p>
            </div>
          )}
        </div>
      )}
    </ToolPage>
  );
}
