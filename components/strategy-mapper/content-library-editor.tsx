"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ContentBlockCategory,
  ContentBlockTemplate,
  ExecutivePayload,
  KeywordRowPayload,
  LaunchStepPayload,
  UpsellWhyPayload,
} from "@/lib/strategy-mapper/content-library";

const inputClass =
  "w-full rounded-lg border border-bip-border bg-bip-page px-3 py-2 text-sm text-bip-text placeholder:text-bip-muted focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30";

const CATEGORY_LABELS: Record<ContentBlockCategory, string> = {
  executive: "Executive Summary",
  keyword_row: "SEO Keyword Rows",
  launch_step: "Launch Roadmap",
  upsell_why: "Phase 2 Upsell Copy",
};

const CATEGORY_ORDER: ContentBlockCategory[] = [
  "executive",
  "keyword_row",
  "launch_step",
  "upsell_why",
];

export default function ContentLibraryEditor() {
  const [blocks, setBlocks] = useState<ContentBlockTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy-mapper/content-blocks");
      const payload = (await res.json()) as {
        blocks?: ContentBlockTemplate[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Failed to load content blocks");
      setBlocks(payload.blocks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content blocks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  const grouped = useMemo(() => {
    const map = new Map<ContentBlockCategory, ContentBlockTemplate[]>();
    for (const category of CATEGORY_ORDER) {
      map.set(
        category,
        blocks
          .filter((b) => b.category === category)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
    }
    return map;
  }, [blocks]);

  async function saveBlock(block: ContentBlockTemplate) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy-mapper/content-blocks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(block),
      });
      const payload = (await res.json()) as {
        blocks?: ContentBlockTemplate[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Failed to save block");
      setBlocks(payload.blocks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save block");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    if (
      !confirm(
        "Reset all report content blocks to factory defaults? Custom edits will be overwritten.",
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy-mapper/content-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-defaults" }),
      });
      const payload = (await res.json()) as {
        blocks?: ContentBlockTemplate[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Failed to reset blocks");
      setBlocks(payload.blocks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset blocks");
    } finally {
      setSaving(false);
    }
  }

  function updatePayload(blockKey: string, payload: ContentBlockTemplate["payload"]) {
    setBlocks((prev) =>
      prev.map((b) => (b.blockKey === blockKey ? { ...b, payload } : b)),
    );
  }

  if (loading) {
    return <p className="text-sm text-bip-muted">Loading content library...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-bip-muted">
          Edit executive summary, keyword matrix, launch roadmap, and upsell templates.
          Placeholders like <code className="text-bip-accent">[Practice Name]</code> and{" "}
          <code className="text-bip-accent">[Top Competitor]</code> are substituted at
          build time.
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={() => void resetDefaults()}
          className="rounded-lg border border-bip-border bg-bip-card px-4 py-2 text-sm text-bip-text hover:bg-bip-fill disabled:opacity-60"
        >
          Reset to defaults
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-bip-danger/30 bg-bip-danger/10 px-4 py-3 text-sm text-bip-danger">
          {error}
        </p>
      ) : null}

      {CATEGORY_ORDER.map((category) => {
        const categoryBlocks = grouped.get(category) ?? [];
        return (
          <section
            key={category}
            className="rounded-xl border border-bip-border bg-bip-card p-5 sm:p-6"
          >
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-bip-accent">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="space-y-4">
              {categoryBlocks.map((block) => (
                <div
                  key={block.blockKey}
                  className="rounded-lg border border-bip-border bg-bip-page/60 p-4"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedKey(expandedKey === block.blockKey ? null : block.blockKey)
                    }
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="font-medium text-bip-text">
                      {block.blockKey}
                      {block.primaryGoal ? (
                        <span className="ml-2 text-xs text-bip-muted">{block.primaryGoal}</span>
                      ) : null}
                      {block.service ? (
                        <span className="ml-2 text-xs text-bip-accent/80">
                          {block.service}
                          {block.framing ? ` · ${block.framing}` : ""}
                        </span>
                      ) : null}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-bip-muted transition ${
                        expandedKey === block.blockKey ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {expandedKey === block.blockKey ? (
                    <div className="mt-4 space-y-3">
                      {block.category === "executive" ? (
                        <ExecutiveEditor
                          payload={block.payload as ExecutivePayload}
                          onChange={(payload) => updatePayload(block.blockKey, payload)}
                        />
                      ) : null}
                      {block.category === "keyword_row" ? (
                        <KeywordRowEditor
                          payload={block.payload as KeywordRowPayload}
                          onChange={(payload) => updatePayload(block.blockKey, payload)}
                        />
                      ) : null}
                      {block.category === "launch_step" ? (
                        <LaunchStepEditor
                          payload={block.payload as LaunchStepPayload}
                          onChange={(payload) => updatePayload(block.blockKey, payload)}
                        />
                      ) : null}
                      {block.category === "upsell_why" ? (
                        <UpsellWhyEditor
                          payload={block.payload as UpsellWhyPayload}
                          onChange={(payload) => updatePayload(block.blockKey, payload)}
                        />
                      ) : null}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveBlock(block)}
                        className="rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-bip-page hover:brightness-110 disabled:opacity-60"
                      >
                        Save block
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ExecutiveEditor({
  payload,
  onChange,
}: {
  payload: ExecutivePayload;
  onChange: (payload: ExecutivePayload) => void;
}) {
  return (
    <>
      <TextField
        label="Mission statement"
        value={payload.missionStatement}
        onChange={(missionStatement) => onChange({ ...payload, missionStatement })}
        rows={3}
      />
      <TextField
        label="Narrative"
        value={payload.narrative}
        onChange={(narrative) => onChange({ ...payload, narrative })}
        rows={3}
      />
      <TextField
        label="Pain point resolution"
        value={payload.painPointResolution}
        onChange={(painPointResolution) => onChange({ ...payload, painPointResolution })}
        rows={3}
      />
      <TextField
        label="Core focus areas (one per line)"
        value={payload.coreFocusAreas.join("\n")}
        onChange={(value) =>
          onChange({
            ...payload,
            coreFocusAreas: value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          })
        }
        rows={5}
      />
    </>
  );
}

function KeywordRowEditor({
  payload,
  onChange,
}: {
  payload: KeywordRowPayload;
  onChange: (payload: KeywordRowPayload) => void;
}) {
  return (
    <>
      <TextField
        label="Intent category"
        value={payload.intentCategory}
        onChange={(intentCategory) => onChange({ ...payload, intentCategory })}
      />
      <TextField
        label="Target geography"
        value={payload.targetGeography}
        onChange={(targetGeography) => onChange({ ...payload, targetGeography })}
      />
      <TextField
        label="Keyword variations (one per line)"
        value={payload.keywordVariations.join("\n")}
        onChange={(value) =>
          onChange({
            ...payload,
            keywordVariations: value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          })
        }
        rows={4}
      />
    </>
  );
}

function LaunchStepEditor({
  payload,
  onChange,
}: {
  payload: LaunchStepPayload;
  onChange: (payload: LaunchStepPayload) => void;
}) {
  return (
    <>
      <TextField
        label="Step number"
        value={String(payload.stepNumber)}
        onChange={(value) =>
          onChange({ ...payload, stepNumber: parseInt(value, 10) || payload.stepNumber })
        }
      />
      <TextField
        label="Title"
        value={payload.title}
        onChange={(title) => onChange({ ...payload, title })}
      />
      <TextField
        label="Description"
        value={payload.description}
        onChange={(description) => onChange({ ...payload, description })}
        rows={3}
      />
    </>
  );
}

function UpsellWhyEditor({
  payload,
  onChange,
}: {
  payload: UpsellWhyPayload;
  onChange: (payload: UpsellWhyPayload) => void;
}) {
  return (
    <TextField
      label="Why it matters"
      value={payload.whyItMatters}
      onChange={(whyItMatters) => onChange({ whyItMatters })}
      rows={3}
    />
  );
}

function TextField({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-bip-muted">{label}</span>
      {rows > 1 ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={`${inputClass} min-h-[80px]`}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
    </label>
  );
}
