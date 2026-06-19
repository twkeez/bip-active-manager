"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CORE_SERVICE_OPTIONS } from "@/lib/strategy-mapper/form-options";
import { buildActiveStrategyBlock } from "@/lib/strategy-mapper/tier-template-engine";
import type { ServiceTierTemplate } from "@/lib/strategy-mapper/tier-library";
import { calculateDualRadius } from "@/lib/strategy-mapper/radius";
import type { StrategyMapperFormData } from "@/types/strategy-mapper";

const inputClass =
  "w-full rounded-lg border border-bip-border bg-bip-page px-3 py-2 text-sm text-bip-text placeholder:text-bip-muted focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30";

const PREVIEW_FORM: StrategyMapperFormData = {
  practiceName: "Sample Animal Hospital",
  practiceOwnerName: "Dr. Sample",
  streetAddress: "100 Main St, Austin, TX 78701",
  locationNotes: "Downtown Austin",
  specializations: ["Small Animal", "Surgical & Diagnostics"],
  customSpecialization: "",
  activeServices: ["seo"],
  primaryGoal: "General new client acquisition / Market dominance",
  strategicContextNotes: "",
};

export default function TierLibraryEditor() {
  const [tiers, setTiers] = useState<ServiceTierTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const loadTiers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy-mapper/tiers");
      const payload = (await res.json()) as { tiers?: ServiceTierTemplate[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to load tiers");
      setTiers(payload.tiers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tiers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTiers();
  }, [loadTiers]);

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceTierTemplate[]>();
    for (const option of CORE_SERVICE_OPTIONS) {
      map.set(
        option.id,
        tiers.filter((t) => t.service === option.id).sort((a, b) => a.tierRank - b.tierRank),
      );
    }
    return map;
  }, [tiers]);

  const previewRadius = calculateDualRadius(PREVIEW_FORM);
  const previewTier = expandedKey ? tiers.find((t) => t.tierKey === expandedKey) : null;
  const previewBlock = previewTier
    ? buildActiveStrategyBlock(previewTier, { form: PREVIEW_FORM, radius: previewRadius })
    : null;

  async function saveTier(tier: ServiceTierTemplate) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy-mapper/tiers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tier),
      });
      const payload = (await res.json()) as { tiers?: ServiceTierTemplate[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to save tier");
      setTiers(payload.tiers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tier");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    if (!confirm("Reset all tier blurbs to factory defaults? Custom edits will be overwritten.")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/strategy-mapper/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-defaults" }),
      });
      const payload = (await res.json()) as { tiers?: ServiceTierTemplate[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to reset tiers");
      setTiers(payload.tiers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset tiers");
    } finally {
      setSaving(false);
    }
  }

  function updateTierField<K extends keyof ServiceTierTemplate>(
    tierKey: string,
    field: K,
    value: ServiceTierTemplate[K],
  ) {
    setTiers((prev) =>
      prev.map((t) => (t.tierKey === tierKey ? { ...t, [field]: value } : t)),
    );
  }

  function updateTactic(tierKey: string, index: number, value: string) {
    setTiers((prev) =>
      prev.map((t) => {
        if (t.tierKey !== tierKey) return t;
        const tactics = [...t.tactics];
        tactics[index] = value;
        return { ...t, tactics };
      }),
    );
  }

  function addTactic(tierKey: string) {
    setTiers((prev) =>
      prev.map((t) =>
        t.tierKey === tierKey ? { ...t, tactics: [...t.tactics, ""] } : t,
      ),
    );
  }

  function removeTactic(tierKey: string, index: number) {
    setTiers((prev) =>
      prev.map((t) => {
        if (t.tierKey !== tierKey) return t;
        return { ...t, tactics: t.tactics.filter((_, i) => i !== index) };
      }),
    );
  }

  function moveTactic(tierKey: string, index: number, direction: "up" | "down") {
    setTiers((prev) =>
      prev.map((t) => {
        if (t.tierKey !== tierKey) return t;
        const tactics = [...t.tactics];
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= tactics.length) return t;
        [tactics[index], tactics[target]] = [tactics[target], tactics[index]];
        return { ...t, tactics };
      }),
    );
  }

  if (loading) {
    return <p className="text-sm text-bip-muted">Loading tier library...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-bip-muted">
          Edit approved Phase 1 blurbs and upsell tier language. Placeholders like{" "}
          <code className="text-bip-accent">[Practice Name]</code> are substituted at
          generation time.
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

      {CORE_SERVICE_OPTIONS.map((serviceOption) => {
        const serviceTiers = grouped.get(serviceOption.id) ?? [];
        return (
          <section
            key={serviceOption.id}
            className="rounded-xl border border-bip-border bg-bip-card p-5 sm:p-6"
          >
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-bip-accent">
              {serviceOption.label}
            </h2>
            <div className="space-y-4">
              {serviceTiers.map((tier) => (
                <div
                  key={tier.tierKey}
                  className="rounded-lg border border-bip-border bg-bip-page/60 p-4"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedKey(expandedKey === tier.tierKey ? null : tier.tierKey)
                    }
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="font-medium text-bip-text">
                      {tier.tierLabel}{" "}
                      <span className="text-xs text-bip-muted">({tier.tierKey})</span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-bip-muted transition ${
                        expandedKey === tier.tierKey ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {expandedKey === tier.tierKey ? (
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm">
                        <span className="mb-1 block text-bip-muted">Section title</span>
                        <input
                          value={tier.title}
                          onChange={(e) =>
                            updateTierField(tier.tierKey, "title", e.target.value)
                          }
                          className={inputClass}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-bip-muted">Objective</span>
                        <textarea
                          value={tier.objective}
                          onChange={(e) =>
                            updateTierField(tier.tierKey, "objective", e.target.value)
                          }
                          rows={3}
                          className={`${inputClass} min-h-[80px]`}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-bip-muted">
                          Match aliases (semicolon-separated)
                        </span>
                        <input
                          value={tier.matchAliases.join("; ")}
                          onChange={(e) =>
                            updateTierField(
                              tier.tierKey,
                              "matchAliases",
                              e.target.value
                                .split(";")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                          className={inputClass}
                          placeholder="SEO Local; SEO Foundation"
                        />
                      </label>
                      <div>
                        <span className="mb-2 block text-sm text-bip-muted">Tactics</span>
                        <ul className="space-y-2">
                          {tier.tactics.map((tactic, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <div className="flex flex-col gap-0.5 pt-2">
                                <button
                                  type="button"
                                  disabled={index === 0 || saving}
                                  onClick={() => moveTactic(tier.tierKey, index, "up")}
                                  className="rounded p-0.5 text-bip-muted hover:bg-bip-card/10 disabled:opacity-30"
                                  aria-label="Move tactic up"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === tier.tactics.length - 1 || saving}
                                  onClick={() => moveTactic(tier.tierKey, index, "down")}
                                  className="rounded p-0.5 text-bip-muted hover:bg-bip-card/10 disabled:opacity-30"
                                  aria-label="Move tactic down"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <textarea
                                value={tactic}
                                onChange={(e) =>
                                  updateTactic(tier.tierKey, index, e.target.value)
                                }
                                rows={2}
                                className={`${inputClass} flex-1`}
                              />
                              <button
                                type="button"
                                onClick={() => removeTactic(tier.tierKey, index)}
                                className="mt-2 rounded p-1 text-bip-muted hover:bg-bip-danger/20 hover:text-bip-danger"
                                aria-label="Remove tactic"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          onClick={() => addTactic(tier.tierKey)}
                          className="mt-2 inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-muted hover:bg-bip-hover"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add tactic
                        </button>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveTier(tier)}
                          className="rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-bip-page hover:brightness-110 disabled:opacity-60"
                        >
                          Save tier
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {previewBlock ? (
        <section className="rounded-xl border border-bip-border bg-bip-card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-bip-accent">
            Preview (sample interpolation)
          </h2>
          <p className="text-sm font-bold text-bip-text">{previewBlock.title}</p>
          <p className="mt-2 text-sm text-bip-muted">
            <strong>Objective:</strong> {previewBlock.objective}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-bip-muted">
            {previewBlock.tactics.map((tactic, i) => (
              <li key={i}>{tactic}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
