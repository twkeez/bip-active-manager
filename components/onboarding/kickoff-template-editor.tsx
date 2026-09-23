"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  kickoffTierBlockKey,
  SERVICE_BLOCK_KEYS,
  type KickoffBlock,
} from "@/lib/clients/onboarding-kickoff";
import {
  SERVICE_EXPECTATION_LABEL,
  SERVICE_EXPECTATION_ORDER,
  SERVICE_TIERS,
  TIER_LABEL,
} from "@/lib/onboarding/service-expectations";
import type { ServiceTierTable } from "@/lib/services/tier-content";
import ScopeReference from "@/components/services/tier-scope-reference";

/**
 * Writing the master Basecamp kickoff message.
 *
 * Each service has a shared block and, where we sell tiers, a block per tier.
 * A client reads the wording for the tier they bought, and the shared block
 * only where that tier has nothing written — so a tier can be left empty
 * safely, and filling it in is what makes the message specific.
 *
 * Each tier's box shows what that tier actually includes, because this message
 * is the first thing a practice reads and the easiest place to promise work
 * nobody sold them.
 */

const GENERAL_LABELS: Record<string, string> = {
  intro: "Intro — always shown",
  closing: "Closing — always shown",
};

function Textarea({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-bip-text">{label}</label>
      {hint && <p className="text-[11px] text-bip-muted">{hint}</p>}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-28 w-full rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 text-sm leading-relaxed text-bip-text focus:border-bip-accent focus:outline-none"
      />
    </div>
  );
}

export default function KickoffTemplateEditor({ tierTables }: { tierTables: ServiceTierTable[] }) {
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<Record<string, number>>({});
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
        setBodies(Object.fromEntries(payload.blocks.map((block) => [block.block_key, block.body])));
        setOrder(Object.fromEntries(payload.blocks.map((block) => [block.block_key, block.sort_order])));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load template");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (key: string, value: string) => {
    setBodies((current) => ({ ...current, [key]: value }));
    setSavedAt(null);
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding-kickoff/blocks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: Object.entries(bodies).map(([block_key, body]) => ({ block_key, body })),
        }),
      });
      const payload = (await response.json()) as { error?: string; blocks?: KickoffBlock[] };
      if (!response.ok || !payload.blocks) throw new Error(payload.error ?? "Failed to save");
      setBodies(Object.fromEntries(payload.blocks.map((block) => [block.block_key, block.body])));
      setOrder(Object.fromEntries(payload.blocks.map((block) => [block.block_key, block.sort_order])));
      setSavedAt(new Date().toLocaleTimeString());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save");
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

  // Blocks arrive with a sort order; unknown keys are kept visible rather than
  // hidden, since a block nobody can see is a block nobody can fix.
  const known = new Set<string>([
    "intro",
    "closing",
    ...SERVICE_EXPECTATION_ORDER.flatMap((service) => [
      SERVICE_BLOCK_KEYS[service],
      ...SERVICE_TIERS[service].map((tier) => kickoffTierBlockKey(service, tier)),
    ]),
  ]);
  const extras = Object.keys(bodies)
    .filter((key) => !known.has(key))
    .sort((a, b) => (order[a] ?? 0) - (order[b] ?? 0));

  return (
    <div className="space-y-4">
      <p className="text-xs text-bip-muted">
        This is the master kickoff template. Edits apply to every client going forward; a strategist can still tweak
        the message per client before copying. Merge fields:{" "}
        <code className="rounded bg-bip-fill px-1">{"{{client_name}}"}</code>{" "}
        <code className="rounded bg-bip-fill px-1">{"{{strategist}}"}</code>{" "}
        <code className="rounded bg-bip-fill px-1">{"{{quarter_label}}"}</code>.
      </p>

      <div className="rounded-lg border border-bip-border bg-bip-card p-3">
        <Textarea label={GENERAL_LABELS.intro} value={bodies.intro ?? ""} onChange={(value) => update("intro", value)} />
      </div>

      {SERVICE_EXPECTATION_ORDER.map((service) => {
        const sharedKey = SERVICE_BLOCK_KEYS[service];
        const tiers = SERVICE_TIERS[service];
        return (
          <div key={service} className="space-y-3 rounded-lg border border-bip-border bg-bip-card p-3">
            <p className="text-sm font-semibold text-bip-text">
              {SERVICE_EXPECTATION_LABEL[service]}{" "}
              <span className="text-xs font-normal text-bip-muted">— shown when this service is active</span>
            </p>
            <Textarea
              label={
                tiers.length > 0
                  ? "Shared wording — used only where the client's tier below is empty"
                  : "Block — shown when this service is active"
              }
              value={bodies[sharedKey] ?? ""}
              onChange={(value) => update(sharedKey, value)}
            />

            {tiers.length > 0 && (
              <div className="space-y-3 rounded-lg border border-dashed border-bip-border p-3">
                <p className="text-xs text-bip-muted">
                  <span className="font-semibold text-bip-text">What we say, by tier.</span> A client reads the version
                  for the tier they bought. Each shows what that tier includes — promise only what is on that list.
                </p>
                {tiers.map((tier) => {
                  const key = kickoffTierBlockKey(service, tier);
                  return (
                    <div key={key} className="space-y-1.5">
                      <Textarea
                        label={`${TIER_LABEL[tier]}`}
                        value={bodies[key] ?? ""}
                        onChange={(value) => update(key, value)}
                      />
                      <ScopeReference service={service} tier={tier} tables={tierTables} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="rounded-lg border border-bip-border bg-bip-card p-3">
        <Textarea
          label={GENERAL_LABELS.closing}
          value={bodies.closing ?? ""}
          onChange={(value) => update("closing", value)}
        />
      </div>

      {extras.map((key) => (
        <div key={key} className="rounded-lg border border-bip-border bg-bip-card p-3">
          <Textarea label={key} value={bodies[key] ?? ""} onChange={(value) => update(key, value)} />
        </div>
      ))}

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-bip-border bg-bip-page/95 py-3 backdrop-blur">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save master template
        </button>
        {savedAt && <span className="text-xs text-bip-muted">Saved {savedAt}</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
