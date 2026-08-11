"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  GraduationCap,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import type {
  ClientServiceKey,
  DetailTabLink,
  OnboardingItemStatus,
} from "@/lib/clients/types";
import type { BasecampThreadEvent } from "@/lib/types/client";
import { moduleForVerification } from "./registry";
import { StepSummary } from "./summaries";
import { useOnboardingController } from "./use-onboarding-controller";

type Props = {
  clientId: number;
  // Accepted for drop-in parity with ClientOnboardingView; unused by the map.
  recentThreads?: BasecampThreadEvent[];
  onOpenTab?: (tab: DetailTabLink) => void;
  onEditClient?: () => void;
  onGraduated?: () => void;
};

// Service groups in the map, in fixed base order (used as sort tie-break).
const SERVICE_GROUPS: Array<{ key: ClientServiceKey; label: string }> = [
  { key: "seo", label: "SEO" },
  { key: "ppc", label: "Google Ads / PPC" },
  { key: "smm", label: "Social" },
  { key: "blog", label: "Blog" },
  { key: "orm", label: "Reviews / ORM" },
];

type MapGroup = {
  id: string; // "foundation" | ClientServiceKey
  label: string;
  baseOrder: number;
  items: OnboardingItemStatus[];
};

function hintIsBlocked(hint: string | null): boolean {
  return !!hint && /block/i.test(hint);
}

// Sort rank within a group: not-done-required, then not-done, then locked, then done.
function cardRank(i: OnboardingItemStatus): number {
  if (i.done) return 3;
  if (i.deferred) return 2;
  if (i.requiredForGraduation) return 0;
  return 1;
}

export default function OnboardingMap({
  clientId,
  onOpenTab,
  onEditClient,
  onGraduated,
}: Props) {
  const controller = useOnboardingController({
    clientId,
    onOpenTab: onOpenTab ? (tab) => onOpenTab(tab as DetailTabLink) : undefined,
    onEditClient,
    onGraduated,
  });
  const { evaluation, loading, busy, error } = controller;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Honest overall progress across both phases (mirrors the wizard).
  const overallRequiredTotal = evaluation
    ? evaluation.foundationRequiredTotalCount + evaluation.launchRequiredTotalCount
    : 0;
  const overallRequiredDone = evaluation
    ? evaluation.foundationRequiredDoneCount + evaluation.launchRequiredDoneCount
    : 0;
  const overallPercent =
    overallRequiredTotal === 0 ? 100 : Math.round((overallRequiredDone / overallRequiredTotal) * 100);
  const stepsLeft = (evaluation?.items ?? []).filter(
    (i) => i.requiredForGraduation && !i.done && !i.deferred,
  );

  const commsTone = useMemo(() => {
    if (!evaluation) return null;
    if (evaluation.commsCadence === "overdue") return "overdue";
    if (evaluation.commsCadence === "due_soon") return "due_soon";
    return null;
  }, [evaluation]);

  // Build service groups (needs-attention floats to top), then map connections.
  const groups = useMemo<MapGroup[]>(() => {
    if (!evaluation) return [];
    const items = evaluation.items;
    const built: MapGroup[] = [];

    const foundationItems = items.filter((i) => i.requiresService == null);
    if (foundationItems.length > 0) {
      built.push({ id: "foundation", label: "Account & Foundation", baseOrder: 0, items: foundationItems });
    }
    SERVICE_GROUPS.forEach((g, idx) => {
      const groupItems = items.filter((i) => i.requiresService === g.key);
      if (groupItems.length > 0) {
        built.push({ id: g.key, label: g.label, baseOrder: idx + 1, items: groupItems });
      }
    });

    // Attention score: non-deferred required-and-not-done items (+1 if any blocked).
    const scoreOf = (grp: MapGroup) => {
      const openRequired = grp.items.filter(
        (i) => !i.deferred && i.requiredForGraduation && !i.done,
      ).length;
      const blocked = grp.items.some((i) => hintIsBlocked(i.hint)) ? 1 : 0;
      return openRequired + blocked;
    };

    built.sort((a, b) => {
      const diff = scoreOf(b) - scoreOf(a);
      if (diff !== 0) return diff;
      return a.baseOrder - b.baseOrder;
    });

    // Sort cards within each group.
    for (const grp of built) {
      grp.items = [...grp.items].sort((a, b) => {
        const r = cardRank(a) - cardRank(b);
        if (r !== 0) return r;
        return a.sortOrder - b.sortOrder;
      });
    }
    return built;
  }, [evaluation]);

  // Map connection-health items into groups by label (spec §4).
  const connByGroup = useMemo<Record<string, Array<{ label: string; connected: boolean }>>>(() => {
    const out: Record<string, Array<{ label: string; connected: boolean }>> = {};
    if (!evaluation) return out;
    const activeIds = new Set(groups.map((g) => g.id));
    const target = (label: string): string => {
      let id: string;
      switch (label) {
        case "Website":
        case "Basecamp":
          id = "foundation";
          break;
        case "Search Console":
        case "GA4":
          id = "seo";
          break;
        case "Google Ads":
          id = "ppc";
          break;
        case "Social":
          id = "smm";
          break;
        case "Google Business Profile":
          id = activeIds.has("orm") ? "orm" : "seo";
          break;
        default:
          id = "foundation";
      }
      return activeIds.has(id) ? id : "foundation";
    };
    for (const it of evaluation.connectionsHealth.items) {
      const id = target(it.label);
      (out[id] ??= []).push(it);
    }
    return out;
  }, [evaluation, groups]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-bip-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading onboarding…
      </div>
    );
  }

  // Not started yet — mirror the wizard's start card.
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
      {/* Progress header — mirrors the wizard's top card */}
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-bip-text">Onboarding · {overallPercent}%</p>
            <p className="text-xs text-bip-muted">
              Foundation {evaluation.foundationRequiredDoneCount}/{evaluation.foundationRequiredTotalCount}
              {evaluation.launchRequiredTotalCount > 0
                ? ` · Launch ${evaluation.launchRequiredDoneCount}/${evaluation.launchRequiredTotalCount}`
                : ""}
              {evaluation.daysInOnboarding != null ? ` · Day ${evaluation.daysInOnboarding}` : ""}
            </p>
          </div>
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
        {/* Connections light — per-connection chips fold into the groups below */}
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
        </div>
      </div>

      {/* Service groups */}
      {groups.map((group) => {
        const doneCount = group.items.filter((i) => i.done).length;
        const conns = connByGroup[group.id] ?? [];
        return (
          <div key={group.id} className="rounded-xl border border-bip-border bg-bip-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-bip-text">{group.label}</p>
              <span className="shrink-0 rounded-md bg-bip-fill px-2 py-0.5 text-[11px] text-bip-muted">
                {doneCount}/{group.items.length}
              </span>
            </div>

            {conns.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {conns.map((c) => (
                  <span
                    key={c.label}
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${c.connected ? "bg-emerald-500/10 text-emerald-400" : "bg-bip-fill text-bip-muted"}`}
                  >
                    {c.connected ? "✓" : "○"} {c.label}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-1.5">
              {group.items.map((item) => {
                const isExpanded = expandedKey === item.itemKey;
                const clickable = !item.deferred;
                const Action = moduleForVerification(item.verification).Action;
                return (
                  <div key={item.itemKey} className="rounded-lg border border-bip-border bg-bip-page/40">
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && setExpandedKey(isExpanded ? null : item.itemKey)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${clickable ? "hover:bg-bip-fill/50" : "cursor-default opacity-70"}`}
                    >
                      {item.deferred ? (
                        <Lock className="h-4 w-4 shrink-0 text-bip-muted" />
                      ) : item.done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-bip-muted" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm text-bip-text">{item.label}</span>
                          {item.requiredForGraduation && !item.done && !item.deferred && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Required to go active" />
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-bip-muted">
                          <StepSummary item={item} controller={controller} />
                        </span>
                      </span>
                      {clickable &&
                        (isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-bip-muted" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-bip-muted" />
                        ))}
                    </button>

                    {isExpanded && clickable && (
                      <div className="border-t border-bip-border px-3 pb-3 pt-2">
                        {item.guidance && (
                          <p className="whitespace-pre-line text-sm leading-relaxed text-bip-muted">{item.guidance}</p>
                        )}
                        {item.hint && !item.done && <p className="mt-2 text-xs text-amber-300">{item.hint}</p>}
                        <Action item={item} controller={controller} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Launch phase — mark the site launched to unlock deferred steps */}
      {evaluation.launchPending && !evaluation.launched && (
        <div className="rounded-xl border border-bip-border bg-bip-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-bip-muted">
              <Lock className="h-3.5 w-3.5" />
              Launch steps unlock once the site is live.
              {evaluation.foundationComplete ? " Foundation is done — mark it launched." : ""}
            </p>
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

      {/* Finish — the onboarding summary report */}
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-bip-accent" />
            <div>
              <p className="text-sm font-semibold text-bip-text">Finish · Onboarding summary</p>
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
