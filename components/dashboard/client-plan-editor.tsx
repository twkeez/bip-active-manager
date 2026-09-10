"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  SERVICE_OFF,
  SERVICE_PLAN_OPTIONS,
  currentChoice,
  diffPlan,
  onboardingItemsAtRisk,
  type ServicePlan,
} from "@/lib/services/plan-edit";

/**
 * Change what a client buys, in place on the client page.
 *
 * Services change often, and the only way to edit them used to be the old
 * drawer's free-text fields. This writes through the same client PATCH, which
 * already reconciles onboarding when a service changes — so the one thing added
 * here is the warning that reconcile deserves: dropping a service mid-onboarding
 * deletes its checklist, ticked items included.
 */

type Props = {
  clientId: number;
  plan: ServicePlan;
  onboardingStatus: string | null;
  accent: string;
  onClose: () => void;
};

export default function ClientPlanEditor({
  clientId,
  plan,
  onboardingStatus,
  accent,
  onClose,
}: Props) {
  const router = useRouter();

  // What the selects start on. Unrecognised stored values are kept verbatim, so
  // opening the editor and pressing Save changes nothing.
  const initial = useMemo(
    () =>
      Object.fromEntries(
        SERVICE_PLAN_OPTIONS.map((option) => [
          option.service,
          currentChoice(option, plan[option.service]).value,
        ]),
      ) as ServicePlan,
    [plan],
  );

  const [draft, setDraft] = useState<ServicePlan>(initial);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changes = diffPlan(initial, draft);
  const atRisk = onboardingItemsAtRisk(changes, onboardingStatus);

  async function save() {
    if (changes.length === 0) {
      onClose();
      return;
    }
    if (atRisk.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Only what changed — sending unchanged services would re-run the
      // onboarding sync for no reason.
      const body = Object.fromEntries(changes.map((change) => [change.service, change.to]));
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Save failed (${response.status})`);
      router.refresh();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  const removedLabels = atRisk.map((change) => change.label);

  return (
    <div className="mt-3 rounded-xl border bg-white/80 p-3" style={{ borderColor: accent }}>
      <div className="grid gap-2 sm:grid-cols-2">
        {SERVICE_PLAN_OPTIONS.map((option) => {
          const stored = currentChoice(option, plan[option.service]);
          return (
            <label key={option.service} className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-semibold text-[#191813]">{option.label}</span>
              <select
                value={draft[option.service]}
                disabled={saving}
                onChange={(event) => {
                  setConfirming(false);
                  setDraft((current) => ({ ...current, [option.service]: event.target.value }));
                }}
                className="w-40 rounded-lg border border-[#E6E3DA] bg-white px-2 py-1 text-[12px] text-[#191813] focus:outline-none"
              >
                <option value={SERVICE_OFF}>Not included</option>
                {option.choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
                {stored.unrecognised && (
                  // Shown so the current value is visible and selectable, not
                  // quietly replaced by the first option.
                  <option value={stored.value}>{stored.value} (non-standard)</option>
                )}
              </select>
            </label>
          );
        })}
      </div>

      {confirming && atRisk.length > 0 && (
        <div className="mt-3 flex gap-2 rounded-lg border border-[#B7791F]/40 bg-[#FFF3DC] p-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B7791F]" />
          <p className="text-[11.5px] leading-snug text-[#191813]">
            This client is still onboarding. Turning off{" "}
            <strong>{removedLabels.join(" and ")}</strong> deletes{" "}
            {removedLabels.length === 1 ? "its" : "their"} onboarding checklist items — including
            any already ticked. Turning {removedLabels.length === 1 ? "it" : "them"} back on later
            recreates the items unticked.
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-[11.5px] text-red-600">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          style={{ background: accent }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {confirming && atRisk.length > 0
            ? "Turn off anyway"
            : changes.length === 0
              ? "Done"
              : `Save ${changes.length} change${changes.length === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={confirming ? () => setConfirming(false) : onClose}
          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#6E6A5E] hover:underline"
        >
          {confirming ? "Go back" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
