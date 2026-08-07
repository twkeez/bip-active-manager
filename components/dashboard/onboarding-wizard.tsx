"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Circle,
  CircleDot,
  FileText,
  GraduationCap,
  ListChecks,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import { ONBOARDING_CATEGORY_LABELS } from "@/lib/clients/onboarding";
import { moduleForVerification } from "@/components/dashboard/onboarding/registry";
import { useOnboardingController } from "@/components/dashboard/onboarding/use-onboarding-controller";
import type { NavTab } from "@/components/dashboard/onboarding/types";

type Props = {
  clientId: number;
  onOpenTab?: (tab: NavTab) => void;
  onEditClient?: () => void;
  onGraduated?: () => void;
};

export default function OnboardingWizard({ clientId, onOpenTab, onEditClient, onGraduated }: Props) {
  const controller = useOnboardingController({ clientId, onOpenTab, onEditClient, onGraduated });
  const { evaluation, loading, busy, error, openKey, setOpenKey } = controller;

  const allItems = evaluation?.items ?? [];
  // Step through the active phase only; at_launch steps that are deferred show
  // separately in the "Comes at launch" group.
  const items = allItems.filter((i) => !i.deferred);
  const deferredItems = allItems.filter((i) => i.deferred);

  // Honest overall progress: count required steps across BOTH phases, so the
  // bar never reads 100% while launch-phase work is still outstanding.
  const overallRequiredTotal = evaluation
    ? evaluation.foundationRequiredTotalCount + evaluation.launchRequiredTotalCount
    : 0;
  const overallRequiredDone = evaluation
    ? evaluation.foundationRequiredDoneCount + evaluation.launchRequiredDoneCount
    : 0;
  const overallPercent =
    overallRequiredTotal === 0 ? 100 : Math.round((overallRequiredDone / overallRequiredTotal) * 100);
  // Required foundation steps still undone — surfaced so skipping is never silent.
  const stepsLeft = items.filter((i) => i.requiredForGraduation && !i.done);

  // Linear stepper position. openKey (from the controller) is the focused step;
  // default to the first step when it's unset. Back/Next move through the
  // foundation list; the rail can still jump to any step.
  const currentIndex = items.findIndex((i) => i.itemKey === openKey);
  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;
  const current = items[effectiveIndex] ?? null;
  const prevStep = effectiveIndex > 0 ? items[effectiveIndex - 1] : null;
  const nextStep = effectiveIndex < items.length - 1 ? items[effectiveIndex + 1] : null;

  const commsTone = useMemo(() => {
    if (!evaluation) return null;
    if (evaluation.commsCadence === "overdue") return "overdue";
    if (evaluation.commsCadence === "due_soon") return "due_soon";
    return null;
  }, [evaluation]);

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
          onClick={() => void controller.startOnboarding()}
          className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Start onboarding
        </button>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress + graduate */}
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-bip-text">
              Onboarding · {overallPercent}%
            </p>
            <p className="text-xs text-bip-muted">
              Foundation {evaluation.foundationRequiredDoneCount}/{evaluation.foundationRequiredTotalCount}
              {evaluation.launchRequiredTotalCount > 0
                ? ` · Launch ${evaluation.launchRequiredDoneCount}/${evaluation.launchRequiredTotalCount}`
                : ""}
              {evaluation.daysInOnboarding != null ? ` · Day ${evaluation.daysInOnboarding}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => void controller.graduate()}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                <GraduationCap className="h-3.5 w-3.5" /> Graduate to Active
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bip-fill">
          <div className="h-full rounded-full bg-bip-accent transition-all" style={{ width: `${overallPercent}%` }} />
        </div>
        {stepsLeft.length > 0 && (
          <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
            {stepsLeft.length} step{stepsLeft.length > 1 ? "s" : ""} left before this client can go active:{" "}
            <span className="text-amber-200">{stepsLeft.map((s) => s.label).join(", ")}</span>
          </p>
        )}
        {commsTone && (
          <p className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${commsTone === "overdue" ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300"}`}>
            <AlertTriangle className="h-3.5 w-3.5" /> {evaluation.commsCadenceLabel}
          </p>
        )}
        {/* Connections health — a light, not steps */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-bip-border pt-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              evaluation.connectionsHealth.status === "green"
                ? "text-emerald-500"
                : evaluation.connectionsHealth.status === "yellow"
                  ? "text-amber-400"
                  : "text-red-400"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                evaluation.connectionsHealth.status === "green"
                  ? "bg-emerald-500"
                  : evaluation.connectionsHealth.status === "yellow"
                    ? "bg-amber-400"
                    : "bg-red-500"
              }`}
            />
            Connections {evaluation.connectionsHealth.connected}/{evaluation.connectionsHealth.total}
          </span>
          {evaluation.connectionsHealth.items.map((it) => (
            <span
              key={it.label}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${it.connected ? "bg-emerald-500/10 text-emerald-400" : "bg-bip-fill text-bip-muted"}`}
            >
              {it.connected ? "✓" : "○"} {it.label}
            </span>
          ))}
        </div>
      </div>

      {/* Guided stepper — progress rail + one focused step at a time */}
      {current && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_1fr]">
          {/* Progress rail */}
          <nav className="h-fit rounded-xl border border-bip-border bg-bip-card p-2">
            <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
              Foundation · now
            </p>
            <ol className="space-y-0.5">
              {items.map((item) => {
                const isCurrent = item.itemKey === current.itemKey;
                return (
                  <li key={item.itemKey}>
                    <button
                      type="button"
                      onClick={() => setOpenKey(item.itemKey)}
                      aria-current={isCurrent ? "step" : undefined}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${isCurrent ? "bg-bip-fill" : "hover:bg-bip-fill/50"}`}
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : isCurrent ? (
                        <CircleDot className="h-4 w-4 shrink-0 text-bip-accent" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-bip-muted" />
                      )}
                      <span
                        className={`min-w-0 flex-1 truncate text-xs ${isCurrent ? "font-semibold text-bip-text" : item.done ? "text-bip-muted" : "text-bip-text"}`}
                      >
                        {item.label}
                      </span>
                      {item.requiredForGraduation && !item.done && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Required to go active" />
                      )}
                    </button>
                  </li>
                );
              })}
              {deferredItems.map((item) => (
                <li key={item.itemKey}>
                  <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 opacity-60">
                    <Lock className="h-4 w-4 shrink-0 text-bip-muted" />
                    <span className="min-w-0 flex-1 truncate text-xs text-bip-muted">{item.label}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-bip-muted">Launch</span>
                  </div>
                </li>
              ))}
            </ol>
          </nav>

          {/* Focused step */}
          <div className="rounded-xl border border-bip-border bg-bip-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-bip-muted">
                  Step {effectiveIndex + 1} of {items.length}
                  {current.severity === "recommended" ? " · Recommended" : ""}
                </p>
                <h3 className="mt-0.5 text-base font-semibold text-bip-text">{current.label}</h3>
              </div>
              <span className="shrink-0 rounded-md bg-bip-fill px-2 py-0.5 text-[11px] text-bip-muted">
                {ONBOARDING_CATEGORY_LABELS[current.category]}
              </span>
            </div>

            {current.guidance && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-bip-muted">{current.guidance}</p>
            )}
            {current.hint && !current.done && <p className="mt-2 text-xs text-amber-300">{current.hint}</p>}
            {current.done && current.autoVerified && (
              <p className="mt-2 text-xs text-emerald-400">Auto-verified ✓</p>
            )}

            {(() => {
              const CurrentAction = moduleForVerification(current.verification).Action;
              return <CurrentAction item={current} controller={controller} />;
            })()}

            {/* Step navigation */}
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-bip-border pt-3">
              <button
                type="button"
                disabled={!prevStep}
                onClick={() => prevStep && setOpenKey(prevStep.itemKey)}
                className="inline-flex items-center gap-1 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
              {nextStep ? (
                <button
                  type="button"
                  onClick={() => setOpenKey(nextStep.itemKey)}
                  className="inline-flex min-w-0 items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  <span className="truncate">Next: {nextStep.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              ) : (
                <span className="text-xs text-bip-muted">Last step</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Launch phase — unlocks the deferred (🔒) steps shown in the rail */}
      {deferredItems.length > 0 && evaluation.launchPending && !evaluation.launched && (
        <div className="rounded-xl border border-bip-border bg-bip-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-bip-text">
                <Lock className="h-3.5 w-3.5 text-bip-muted" />
                Comes at launch{evaluation.websiteLaunchDate ? ` · ${fmtLaunchDate(evaluation.websiteLaunchDate)}` : ""}
              </p>
              <p className="text-xs text-bip-muted">
                {deferredItems.length} step{deferredItems.length > 1 ? "s" : ""} unlock once the site is live.
                {evaluation.foundationComplete
                  ? " Foundation steps are done — mark it launched to unlock them."
                  : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void controller.markLaunched()}
              className="inline-flex items-center gap-1 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              <ArrowRight className="h-3.5 w-3.5" /> Mark launched
            </button>
          </div>
        </div>
      )}

      {/* Capstone — the onboarding summary report, the deliverable of this flow */}
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-bip-accent" />
            <div>
              <p className="text-sm font-semibold text-bip-text">Onboarding summary</p>
              <p className="mt-0.5 max-w-md text-xs text-bip-muted">
                One report from everything gathered here. Share the client version to set expectations up
                front; keep the internal version as your full record.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/onboarding-report-print/${clientId}?mode=client`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              <FileText className="h-3.5 w-3.5" /> Client version
            </a>
            <a
              href={`/onboarding-report-print/${clientId}?mode=internal`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill"
            >
              <FileText className="h-3.5 w-3.5" /> Internal version
            </a>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function fmtLaunchDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
