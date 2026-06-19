"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { previewText } from "@/lib/basecamp/display";
import { ONBOARDING_CATEGORY_LABELS } from "@/lib/clients/onboarding";
import type {
  ClientOnboardingEvaluation,
  DetailTabLink,
  OnboardingItemStatus,
} from "@/lib/clients/types";
import type { BasecampThreadEvent } from "@/lib/types/client";
type Props = {
  clientId: number;
  recentThreads?: BasecampThreadEvent[];
  onOpenTab?: (tab: DetailTabLink) => void;
  onEditClient?: () => void;
  onGraduated?: () => void;
};
function ItemRow({
  item,
  busy,
  onToggleManual,
  onOpenTab,
  onEditClient,
}: {
  item: OnboardingItemStatus;
  busy: boolean;
  onToggleManual: (itemKey: string, done: boolean) => void;
  onOpenTab?: (tab: DetailTabLink) => void;
  onEditClient?: () => void;
}) {
  const isManual =
    item.verification.startsWith("manual:") &&
    item.verification !== "manual:record_created";
  const action = item.actionTab;
  return (
    <li className="flex items-start gap-2 border-b border-zinc-100 py-2.5 last:border-0">
      
      {isManual ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleManual(item.itemKey, !item.done)}
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${item.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-bip-border bg-bip-card text-transparent hover:border-emerald-500"}`}
          aria-label={item.done ? "Mark incomplete" : "Mark complete"}
        >
          
          <Check className="h-3 w-3" />
        </button>
      ) : item.done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-bip-text" />
      )}
      <div className="min-w-0 flex-1">
        
        <p
          className={`text-sm ${item.done ? "text-bip-muted line-through" : "font-medium text-bip-text"}`}
        >
          
          {item.label}
        </p>
        {item.hint && !item.done && (
          <p className="mt-0.5 text-xs text-bip-muted">{item.hint}</p>
        )}
        {item.autoVerified && item.done && (
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-emerald-600">
            
            Auto-verified
          </p>
        )}
        {action && !item.done && (
          <button
            type="button"
            onClick={() => {
              if (action === "edit") onEditClient?.();
              else onOpenTab?.(action);
            }}
            className="mt-1 text-xs font-medium text-violet-700 underline hover:text-violet-900"
          >
            
            {action === "edit" ? "Edit client" : `Open ${action}`}
          </button>
        )}
      </div>
    </li>
  );
}
export default function ClientOnboardingView({
  clientId,
  recentThreads = [],
  onOpenTab,
  onEditClient,
  onGraduated,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] =
    useState<ClientOnboardingEvaluation | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [graduating, setGraduating] = useState(false);
  const loadEvaluation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}/onboarding`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        error?: string;
        evaluation?: ClientOnboardingEvaluation;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load onboarding.");
      }
      setEvaluation(payload.evaluation ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load onboarding.",
      );
    } finally {
      setLoading(false);
    }
  }, [clientId]);
  useEffect(() => {
    void loadEvaluation();
  }, [loadEvaluation]);
  const groupedItems = useMemo(() => {
    if (!evaluation) return [];
    const groups = new Map<string, OnboardingItemStatus[]>();
    for (const item of evaluation.items) {
      const key = item.category;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([category, items]) => ({
      category,
      label:
        ONBOARDING_CATEGORY_LABELS[
          category as keyof typeof ONBOARDING_CATEGORY_LABELS
        ],
      items,
    }));
  }, [evaluation]);
  async function handleToggleManual(itemKey: string, done: boolean) {
    setBusyKey(itemKey);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/onboarding/items/${encodeURIComponent(itemKey)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        evaluation?: ClientOnboardingEvaluation;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Failed to update item.");
      if (payload.evaluation) setEvaluation(payload.evaluation);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update item.",
      );
    } finally {
      setBusyKey(null);
    }
  }
  async function handleStart() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/onboarding/start`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        evaluation?: ClientOnboardingEvaluation;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Failed to start onboarding.");
      if (payload.evaluation) setEvaluation(payload.evaluation);
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Failed to start.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function handleGraduate() {
    setGraduating(true);
    try {
      const response = await fetch(
        `/api/clients/${clientId}/onboarding/complete`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        evaluation?: ClientOnboardingEvaluation;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Failed to complete onboarding.");
      if (payload.evaluation) setEvaluation(payload.evaluation);
      onGraduated?.();
    } catch (graduateError) {
      setError(
        graduateError instanceof Error
          ? graduateError.message
          : "Failed to complete onboarding.",
      );
    } finally {
      setGraduating(false);
    }
  }
  if (loading && !evaluation) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-bip-muted">
        
        <Loader2 className="h-4 w-4 animate-spin" /> Loading onboarding
        checklist…
      </div>
    );
  }
  if (!evaluation || evaluation.onboardingStatus !== "active") {
    return (
      <div className="space-y-4 rounded-xl border border-bip-border bg-bip-card p-4">
        
        <p className="text-sm text-bip-text">
          
          {evaluation?.onboardingStatus === "complete"
            ? "This client has completed onboarding."
            : "Onboarding has not been started for this client yet."}
        </p>
        {evaluation?.onboardingStatus !== "complete" && (
          <button
            type="button"
            onClick={() => void handleStart()}
            className="rounded-md border border-bip-border bg-bip-card px-3 py-2 text-sm font-medium hover:bg-bip-page"
          >
            
            Start onboarding
          </button>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
  const latestThread = recentThreads[0];
  const cadenceTone =
    evaluation.commsCadence === "overdue"
      ? "border-red-200 bg-red-50 text-red-900"
      : evaluation.commsCadence === "due_soon"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-900";
  return (
    <div className="space-y-4">
      
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        
        <div className="flex flex-wrap items-start justify-between gap-3">
          
          <div>
            
            <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
              
              Onboarding progress
            </p>
            <p className="mt-1 text-2xl font-semibold text-bip-text">
              
              {evaluation.progressPercent}%
            </p>
            <p className="text-xs text-bip-muted">
              
              {evaluation.requiredDoneCount} of {evaluation.requiredTotalCount}
              required steps
              {evaluation.daysInOnboarding != null
                ? ` · Day ${evaluation.daysInOnboarding}`
                : ""}
            </p>
          </div>
          {evaluation.readyToGraduate && (
            <button
              type="button"
              disabled={graduating}
              onClick={() => void handleGraduate()}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
            >
              
              {graduating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Complete onboarding
            </button>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
          
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${evaluation.progressPercent}%` }}
          />
        </div>
        {evaluation.setupBlocked && (
          <p className="mt-3 inline-flex items-center gap-1 text-xs text-amber-800">
            
            <AlertTriangle className="h-3.5 w-3.5" /> Required connection gaps
            remain — check Connections tab.
          </p>
        )}
      </div>
      <div className={`rounded-xl border p-4 ${cadenceTone}`}>
        
        <div className="flex items-center gap-2">
          
          <MessageSquare className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">Communication cadence</p>
        </div>
        <p className="mt-1 text-sm">{evaluation.commsCadenceLabel}</p>
        {latestThread && (
          <div className="mt-3 rounded-lg border border-black/5 bg-bip-card/60 p-3 text-sm text-bip-text">
            
            {latestThread.thread_title && (
              <p className="font-medium text-bip-text">
                {latestThread.thread_title}
              </p>
            )}
            <p className="mt-1 text-xs text-bip-muted">
              
              {latestThread.author_email ?? "Unknown sender"}
            </p>
            <p className="mt-1 text-sm">{previewText(latestThread)}</p>
          </div>
        )}
        {onOpenTab && (
          <button
            type="button"
            onClick={() => onOpenTab("comms")}
            className="mt-2 text-xs font-medium underline"
          >
            
            View comms details
          </button>
        )}
      </div>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          
          {error}
        </p>
      )}
      {groupedItems.map((group) => (
        <section
          key={group.category}
          className="overflow-hidden rounded-xl border border-bip-border bg-bip-card"
        >
          
          <div className="border-b border-bip-border bg-bip-page px-4 py-2">
            
            <h3 className="text-xs font-semibold uppercase tracking-wide text-bip-text">
              
              {group.label}
            </h3>
          </div>
          <ul className="px-4">
            
            {group.items.map((item) => (
              <ItemRow
                key={item.itemKey}
                item={item}
                busy={busyKey === item.itemKey}
                onToggleManual={handleToggleManual}
                onOpenTab={onOpenTab}
                onEditClient={onEditClient}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
