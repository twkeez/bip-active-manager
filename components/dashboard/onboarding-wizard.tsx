"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  GraduationCap,
  ListChecks,
  Loader2,
  Sparkles,
} from "lucide-react";
import OnboardingKickoffPanel from "@/components/dashboard/onboarding-kickoff-panel";
import { ONBOARDING_CATEGORY_LABELS } from "@/lib/clients/onboarding";
import type { ClientOnboardingEvaluation, DetailTabLink } from "@/lib/clients/types";
import type { ClientDetailTab } from "@/lib/dashboard/client-workspace-types";

type NavTab = ClientDetailTab | "edit";

type Props = {
  clientId: number;
  onOpenTab?: (tab: NavTab) => void;
  onEditClient?: () => void;
  onGraduated?: () => void;
};

const ACTION_LABELS: Partial<Record<DetailTabLink, string>> = {
  connections: "Open Connections",
  reporting: "Open Reporting",
  seo: "Open SEO",
  comms: "Open Comms",
};

export default function OnboardingWizard({ clientId, onOpenTab, onEditClient, onGraduated }: Props) {
  const [evaluation, setEvaluation] = useState<ClientOnboardingEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/onboarding`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; evaluation?: ClientOnboardingEvaluation };
        if (cancelled) return;
        if (!response.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to load onboarding");
        setEvaluation(payload.evaluation);
        // Jump to the first not-yet-done step in the active phase.
        const active = payload.evaluation.items.filter((i) => !i.deferred);
        const firstOpen = active.findIndex((i) => !i.done);
        setIndex(firstOpen === -1 ? 0 : firstOpen);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load onboarding");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const allItems = evaluation?.items ?? [];
  // Step through the active phase only; at_launch steps that are deferred show
  // separately in the "Comes at launch" group.
  const items = allItems.filter((i) => !i.deferred);
  const deferredItems = allItems.filter((i) => i.deferred);
  const current = items[index] ?? null;

  const commsTone = useMemo(() => {
    if (!evaluation) return null;
    if (evaluation.commsCadence === "overdue") return "overdue";
    if (evaluation.commsCadence === "due_soon") return "due_soon";
    return null;
  }, [evaluation]);

  async function startOnboarding() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/start`, { method: "POST" });
      const payload = (await response.json()) as { error?: string; evaluation?: ClientOnboardingEvaluation };
      if (!response.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to start onboarding");
      setEvaluation(payload.evaluation);
      setIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start onboarding");
    } finally {
      setBusy(false);
    }
  }

  async function toggleManual(itemKey: string, done: boolean) {
    setBusy(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/items/${encodeURIComponent(itemKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      const payload = (await response.json()) as { error?: string; evaluation?: ClientOnboardingEvaluation };
      if (!response.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to update step");
      setEvaluation(payload.evaluation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update step");
    } finally {
      setBusy(false);
    }
  }

  async function markLaunched() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launched: true }),
      });
      const payload = (await response.json()) as { error?: string; evaluation?: ClientOnboardingEvaluation };
      if (!response.ok || !payload.evaluation) throw new Error(payload.error ?? "Failed to mark launched");
      setEvaluation(payload.evaluation);
      const active = payload.evaluation.items.filter((i) => !i.deferred);
      const firstOpen = active.findIndex((i) => !i.done);
      setIndex(firstOpen === -1 ? 0 : firstOpen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark launched");
    } finally {
      setBusy(false);
    }
  }

  async function graduate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding/complete`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to graduate");
      onGraduated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to graduate");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-bip-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading onboarding…
      </div>
    );
  }

  // Not started yet.
  if (!evaluation || evaluation.onboardingStatus !== "active") {
    return (
      <div className="rounded-xl border border-bip-border bg-bip-card p-6 text-center">
        <Sparkles className="mx-auto mb-2 h-6 w-6 text-bip-accent" />
        <p className="text-sm text-bip-text">Onboarding hasn&apos;t been started for this client yet.</p>
        <p className="mb-4 mt-1 text-xs text-bip-muted">
          Starting it builds a guided checklist tailored to the services they bought.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void startOnboarding()}
          className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Start onboarding
        </button>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  const isManual = current
    ? current.verification.startsWith("manual:") && current.verification !== "manual:record_created"
    : false;
  const isComms = current?.category === "communication";

  return (
    <div className="space-y-4">
      {/* Progress + graduate */}
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-bip-text">
              Onboarding · {evaluation.progressPercent}%
            </p>
            <p className="text-xs text-bip-muted">
              {evaluation.requiredDoneCount} of {evaluation.requiredTotalCount} required steps done
              {evaluation.daysInOnboarding != null ? ` · Day ${evaluation.daysInOnboarding}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenTab?.("onboarding")}
              className="inline-flex items-center gap-1 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-text hover:bg-bip-fill"
            >
              <ListChecks className="h-3.5 w-3.5" /> Full checklist
            </button>
            {evaluation.readyToGraduate && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void graduate()}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                <GraduationCap className="h-3.5 w-3.5" /> Graduate to Active
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bip-fill">
          <div className="h-full rounded-full bg-bip-accent transition-all" style={{ width: `${evaluation.progressPercent}%` }} />
        </div>
        {commsTone && (
          <p className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${commsTone === "overdue" ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300"}`}>
            <AlertTriangle className="h-3.5 w-3.5" /> {evaluation.commsCadenceLabel}
          </p>
        )}
      </div>

      {/* Current step */}
      {current && (
        <div className="rounded-xl border border-bip-border bg-bip-card p-4">
          <div className="mb-1 flex items-center justify-between text-xs text-bip-muted">
            <span className="uppercase tracking-wide">
              {ONBOARDING_CATEGORY_LABELS[current.category]} · Step {index + 1} of {items.length}
            </span>
            <span>
              {current.severity === "recommended" ? "Recommended" : "Required"}
            </span>
          </div>

          <div className="flex items-start gap-3">
            {current.done ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="mt-0.5 h-6 w-6 shrink-0 text-bip-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-bip-text">{current.label}</p>
              {current.guidance && <p className="mt-1 text-sm leading-relaxed text-bip-muted">{current.guidance}</p>}
              {current.hint && !current.done && (
                <p className="mt-1 text-xs text-amber-300">{current.hint}</p>
              )}
              {current.done && current.autoVerified && (
                <p className="mt-1 text-xs text-emerald-400">Auto-verified ✓</p>
              )}

              {/* Per-step action */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isManual ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleManual(current.itemKey, !current.done)}
                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${current.done ? "border border-bip-border text-bip-muted hover:bg-bip-fill" : "bg-emerald-600 text-white hover:bg-emerald-500"} disabled:opacity-60`}
                  >
                    <Check className="h-3.5 w-3.5" /> {current.done ? "Mark not done" : "Mark done"}
                  </button>
                ) : !current.done ? (
                  <span className="text-xs text-bip-muted">This step verifies itself once the data is in place.</span>
                ) : null}

                {current.actionTab && current.actionTab !== "edit" && ACTION_LABELS[current.actionTab] && (
                  <button
                    type="button"
                    onClick={() => onOpenTab?.(current.actionTab!)}
                    className="inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
                  >
                    {ACTION_LABELS[current.actionTab]} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {current.actionTab === "edit" && (
                  <button
                    type="button"
                    onClick={() => onEditClient?.()}
                    className="inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
                  >
                    Edit client profile <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Kickoff generator lives on the communication step */}
              {isComms && (
                <div className="mt-4">
                  <OnboardingKickoffPanel clientId={clientId} />
                </div>
              )}
            </div>
          </div>

          {/* Step nav */}
          <div className="mt-4 flex items-center justify-between border-t border-bip-border pt-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <span className="text-xs text-bip-muted">{index + 1} / {items.length}</span>
            <button
              type="button"
              disabled={index >= items.length - 1}
              onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
              className="inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill disabled:opacity-40"
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Deferred phase — unlocks at launch */}
      {deferredItems.length > 0 && (
        <div className="rounded-xl border border-bip-border bg-bip-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-bip-text">
                Comes at launch{evaluation.websiteLaunchDate ? ` · ${fmtLaunchDate(evaluation.websiteLaunchDate)}` : ""}
              </p>
              <p className="text-xs text-bip-muted">
                {deferredItems.length} step{deferredItems.length > 1 ? "s" : ""} unlock once the site is live.
              </p>
            </div>
            {evaluation.launchPending && !evaluation.launched && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void markLaunched()}
                className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                <ArrowRight className="h-3.5 w-3.5" /> Mark launched
              </button>
            )}
          </div>
          {evaluation.foundationComplete && evaluation.launchPending && !evaluation.launched && (
            <p className="mt-2 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
              Foundation steps complete — mark the site launched to unlock the rest.
            </p>
          )}
          <ul className="mt-3 space-y-1.5">
            {deferredItems.map((i) => (
              <li key={i.itemKey} className="flex items-center gap-2 text-xs text-bip-muted">
                <Circle className="h-3 w-3 shrink-0" /> {i.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function fmtLaunchDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
