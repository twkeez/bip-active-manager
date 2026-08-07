"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
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

      {/* Foundation steps — a scannable, single-open accordion */}
      {items.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
            Foundation · now
          </p>
          <div className="overflow-hidden rounded-xl border border-bip-border bg-bip-card">
            {items.map((item) => {
              const open = item.itemKey === openKey;
              const ActionComponent = moduleForVerification(item.verification).Action;
              return (
                <div key={item.itemKey} className="border-b border-bip-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenKey((k) => (k === item.itemKey ? null : item.itemKey))}
                    aria-expanded={open}
                    className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors ${open ? "bg-bip-fill/40" : "hover:bg-bip-fill/40"}`}
                  >
                    {item.done ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className={`h-5 w-5 shrink-0 ${open ? "text-bip-accent" : "text-bip-muted"}`} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${open ? "font-semibold text-bip-text" : item.done ? "text-bip-muted" : "text-bip-text"}`}
                      >
                        {item.label}
                      </span>
                    </span>
                    {item.hint && !item.done && !open && (
                      <span className="hidden shrink-0 items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300 sm:inline-flex">
                        <AlertTriangle className="h-3 w-3" /> Needs input
                      </span>
                    )}
                    <span className="shrink-0 text-[11px] text-bip-muted">
                      {ONBOARDING_CATEGORY_LABELS[item.category]}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-bip-muted transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <div className="px-3.5 pb-4 pl-[46px]">
                      {item.severity === "recommended" && (
                        <span className="mb-2 inline-block rounded bg-bip-fill px-1.5 py-0.5 text-[10px] text-bip-muted">
                          Recommended
                        </span>
                      )}
                      {item.guidance && (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-bip-muted">{item.guidance}</p>
                      )}
                      {item.hint && !item.done && <p className="mt-1 text-xs text-amber-300">{item.hint}</p>}
                      {item.done && item.autoVerified && (
                        <p className="mt-1 text-xs text-emerald-400">Auto-verified ✓</p>
                      )}
                      <ActionComponent item={item} controller={controller} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deferred phase — unlocks at launch */}
      {deferredItems.length > 0 && (
        <div className="rounded-xl border border-bip-border bg-bip-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-bip-text">
                <Lock className="h-3.5 w-3.5 text-bip-muted" />
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
                onClick={() => void controller.markLaunched()}
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
