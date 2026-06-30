"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { KickoffBlock } from "@/lib/clients/onboarding-kickoff";

const BLOCK_LABELS: Record<string, string> = {
  intro: "Intro — always shown",
  svc_seo: "SEO block — shown when SEO is active",
  svc_ppc: "PPC block — shown when PPC is active",
  svc_smm: "SMM block — shown when SMM is active",
  svc_blog: "Blog block — shown when Blog is active",
  svc_orm: "ORM block — shown when ORM is active",
  closing: "Closing — always shown",
};

export default function KickoffTemplateEditor() {
  const [blocks, setBlocks] = useState<KickoffBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/onboarding-kickoff/blocks", { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; blocks?: KickoffBlock[] };
        if (!response.ok || !payload.blocks) throw new Error(payload.error ?? "Failed to load template");
        setBlocks(payload.blocks);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load template");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateBlock(key: string, value: string) {
    setBlocks((prev) => prev.map((b) => (b.block_key === key ? { ...b, body: value } : b)));
    setSavedAt(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding-kickoff/blocks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: blocks.map((b) => ({ block_key: b.block_key, body: b.body })) }),
      });
      const payload = (await response.json()) as { error?: string; blocks?: KickoffBlock[] };
      if (!response.ok || !payload.blocks) throw new Error(payload.error ?? "Failed to save");
      setBlocks(payload.blocks);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-bip-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading template…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-bip-muted">
        This is the master kickoff template. Edits apply to every client going forward; a strategist can still tweak the
        message per client before copying. Merge fields:{" "}
        <code className="rounded bg-bip-fill px-1">{"{{client_name}}"}</code>{" "}
        <code className="rounded bg-bip-fill px-1">{"{{strategist}}"}</code>{" "}
        <code className="rounded bg-bip-fill px-1">{"{{quarter_label}}"}</code>.
      </p>

      {blocks.map((block) => (
        <div key={block.block_key} className="rounded-lg border border-bip-border bg-bip-card p-3">
          <label className="text-xs font-semibold text-bip-text">{BLOCK_LABELS[block.block_key] ?? block.block_key}</label>
          <textarea
            value={block.body}
            onChange={(e) => updateBlock(block.block_key, e.target.value)}
            className="mt-1 min-h-28 w-full rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm leading-relaxed text-bip-text focus:border-bip-accent focus:outline-none"
          />
        </div>
      ))}

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-bip-border bg-bip-page/95 py-3 backdrop-blur">
        <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save master template
        </button>
        {savedAt && <span className="text-xs text-bip-muted">Saved {savedAt}</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
