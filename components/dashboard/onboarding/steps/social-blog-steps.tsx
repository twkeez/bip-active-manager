"use client";

import { useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { WebsiteField } from "../shared";
import type { BlogTopic, BrandElements, StepModule, StepModuleContext } from "../types";

function BrandAssetsAction({ item, controller }: StepModuleContext) {
  const { clientId, clientProfile, busy, toggleManual, initialData } = controller;
  const [brandElements, setBrandElements] = useState<BrandElements | null>(initialData.brandElements);
  const [brandRunning, setBrandRunning] = useState(false);
  const [brandMsg, setBrandMsg] = useState<string | null>(null);

  async function runBrandElements() {
    setBrandRunning(true);
    setBrandMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/brand-elements`, { method: "POST" });
      const payload = (await res.json()) as { error?: string; brandElements?: BrandElements };
      if (!res.ok || !payload.brandElements) throw new Error(payload.error ?? "Brand pull failed");
      setBrandElements(payload.brandElements);
    } catch (e) {
      setBrandMsg(e instanceof Error ? e.message : "Brand pull failed");
    } finally {
      setBrandRunning(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {!clientProfile?.website && <WebsiteField controller={controller} />}
      {!brandElements ? (
        <button
          type="button"
          disabled={brandRunning}
          onClick={() => void runBrandElements()}
          className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {brandRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {brandRunning ? "Pulling…" : "Pull brand elements from website"}
        </button>
      ) : (
        <div className="space-y-2 rounded-lg border border-bip-border bg-bip-fill p-3">
          <div className="flex flex-wrap items-end gap-3">
            {brandElements.logoUrl && (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brandElements.logoUrl} alt="logo" className="h-12 w-12 rounded bg-white object-contain" />
                <p className="mt-0.5 text-[10px] text-bip-muted">logo</p>
              </div>
            )}
            {brandElements.themeColor && (
              <div className="text-center">
                <span className="inline-block h-12 w-12 rounded border border-bip-border" style={{ background: brandElements.themeColor }} />
                <p className="mt-0.5 text-[10px] text-bip-muted">{brandElements.themeColor}</p>
              </div>
            )}
          </div>
          {brandElements.heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandElements.heroImage} alt="hero" className="max-h-28 w-full rounded object-cover" />
          )}
          {brandElements.title && <p className="text-[11px] text-bip-muted">{brandElements.title}</p>}
          {!brandElements.logoUrl && !brandElements.heroImage && !brandElements.themeColor && (
            <p className="text-[11px] text-bip-muted">Nothing extractable found — gather assets manually.</p>
          )}
          <button
            type="button"
            disabled={brandRunning}
            onClick={() => void runBrandElements()}
            className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-60"
          >
            {brandRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-pull
          </button>
        </div>
      )}
      {brandMsg && <p className="text-xs text-bip-muted">{brandMsg}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggleManual(item.itemKey, !item.done)}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
      >
        <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
      </button>
    </div>
  );
}

function BlogScheduleAction({ item, controller }: StepModuleContext) {
  const { clientId, busy, toggleManual } = controller;
  const [blogTopics, setBlogTopics] = useState<BlogTopic[] | null>(null);
  const [topicsRunning, setTopicsRunning] = useState(false);
  const [topicsMsg, setTopicsMsg] = useState<string | null>(null);

  async function runBlogTopics() {
    setTopicsRunning(true);
    setTopicsMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/onboarding/blog-topics`, { cache: "no-store" });
      const payload = (await res.json()) as { error?: string; topics?: BlogTopic[] };
      if (!res.ok) throw new Error(payload.error ?? "Failed to load topics");
      const topics = payload.topics ?? [];
      setBlogTopics(topics);
      if (topics.length === 0) setTopicsMsg("No blog performance data across clients yet.");
    } catch (e) {
      setTopicsMsg(e instanceof Error ? e.message : "Failed to load topics");
    } finally {
      setTopicsRunning(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {!blogTopics ? (
        <button
          type="button"
          disabled={topicsRunning}
          onClick={() => void runBlogTopics()}
          className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {topicsRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {topicsRunning ? "Loading…" : "Suggest topics"}
        </button>
      ) : blogTopics.length > 0 ? (
        <div className="space-y-1.5 rounded-lg border border-bip-border bg-bip-fill p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Top blog topics across clients</p>
          {blogTopics.map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-bip-text">{t.topic}</span>
              <span className="shrink-0 text-[11px] text-bip-muted">{t.clicks.toLocaleString()} clicks · {t.clients} client{t.clients === 1 ? "" : "s"}</span>
            </div>
          ))}
          <button
            type="button"
            disabled={topicsRunning}
            onClick={() => void runBlogTopics()}
            className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-60"
          >
            {topicsRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-run
          </button>
        </div>
      ) : null}
      {topicsMsg && <p className="text-xs text-bip-muted">{topicsMsg}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggleManual(item.itemKey, !item.done)}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${item.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
      >
        <Check className="h-3.5 w-3.5" /> {item.done ? "Mark not done" : "Mark done"}
      </button>
    </div>
  );
}

export const BrandAssetsStep: StepModule = {
  match: (v) => v === "manual:smm_brand_assets",
  Action: BrandAssetsAction,
};

export const BlogScheduleStep: StepModule = {
  match: (v) => v === "manual:blog_schedule",
  Action: BlogScheduleAction,
};
