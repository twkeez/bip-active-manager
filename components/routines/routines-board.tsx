"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  XCircle,
} from "lucide-react";
import type { RoutineFinding, RoutineRow, RoutineRunRow, RoutineStatus } from "@/lib/routines/types";

/**
 * The routines the app runs on its own, and what each one found.
 *
 * Laid out for the question someone actually brings to it: "what did this
 * morning's review say?" So each routine leads with its latest run, grouped the
 * way the routine groups it, with links straight to the thread. History sits
 * underneath for the other question — "has it been running?"
 */

type RoutineView = RoutineRow & {
  scheduleText: string;
  nextRunAt: string | null;
  runs: RoutineRunRow[];
};

const STATUS: Record<RoutineStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  ok: { label: "All clear", tone: "text-emerald-600", icon: CheckCircle2 },
  attention: { label: "Needs attention", tone: "text-amber-600", icon: AlertTriangle },
  error: { label: "Failed", tone: "text-red-500", icon: XCircle },
};

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Findings({ findings }: { findings: RoutineFinding[] }) {
  const groups = new Map<string, RoutineFinding[]>();
  for (const finding of findings) groups.set(finding.group, [...(groups.get(finding.group) ?? []), finding]);
  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([group, items]) => (
        <div key={group}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
            {group} ({items.length})
          </p>
          <ul className="mt-1.5 space-y-1">
            {items.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden
                  className={`mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                    item.flagged ? "bg-amber-500" : "bg-bip-border"
                  }`}
                />
                <div className="min-w-0">
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-bip-text hover:underline"
                    >
                      {item.label} <ExternalLink className="h-3 w-3 text-bip-muted" />
                    </a>
                  ) : (
                    <span className="text-bip-text">{item.label}</span>
                  )}
                  <p className="text-xs text-bip-muted">{item.meta}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RoutineCard({ routine, onChanged }: { routine: RoutineView; onChanged: () => void }) {
  const [busy, setBusy] = useState<"run" | "toggle" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const latest = routine.runs[0] ?? null;
  const status = latest?.status ? STATUS[latest.status] : null;
  const StatusIcon = status?.icon;

  async function act(kind: "run" | "toggle") {
    setBusy(kind);
    setError(null);
    try {
      const response =
        kind === "run"
          ? await fetch(`/api/routines/${routine.id}/run`, { method: "POST" })
          : await fetch(`/api/routines/${routine.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enabled: !routine.enabled }),
            });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "That did not work");
      onChanged();
    } catch (actError) {
      setError(actError instanceof Error ? actError.message : "That did not work");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-bip-border bg-bip-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-bip-text">{routine.name}</p>
          <p className="mt-0.5 text-xs italic text-bip-muted">&ldquo;{routine.instruction}&rdquo;</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-bip-muted">
            <Clock className="h-3 w-3" /> {routine.scheduleText}
            {routine.enabled ? ` · next ${when(routine.nextRunAt)}` : " · paused"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void act("toggle")}
            className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-2.5 py-1.5 text-xs text-bip-text hover:bg-bip-fill disabled:opacity-50"
          >
            {busy === "toggle" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : routine.enabled ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {routine.enabled ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void act("run")}
            className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy === "run" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run now
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <div className="mt-4 border-t border-bip-border pt-3">
        {!latest ? (
          <p className="text-sm text-bip-muted">
            Has not run yet. It will run {routine.enabled ? `at ${when(routine.nextRunAt)}` : "once resumed"}, or press
            Run now.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {status && StatusIcon && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.tone}`}>
                  <StatusIcon className="h-3.5 w-3.5" /> {status.label}
                </span>
              )}
              {!latest.finished_at && (
                <span className="text-xs text-amber-600">Did not finish — it stopped part-way.</span>
              )}
              <span className="text-[11px] text-bip-muted">
                {latest.trigger === "manual" ? "Run by hand" : "Scheduled run"} · {when(latest.started_at)}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-bip-text">{latest.headline}</p>
            {latest.findings.length > 0 && (
              <div className="mt-3">
                <Findings findings={latest.findings} />
              </div>
            )}
          </>
        )}
      </div>

      {routine.runs.length > 1 && (
        <div className="mt-3 border-t border-bip-border pt-2">
          <button
            type="button"
            onClick={() => setShowHistory((open) => !open)}
            className="inline-flex items-center gap-1 text-xs text-bip-muted hover:text-bip-text"
          >
            {showHistory ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Earlier runs
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1">
              {routine.runs.slice(1).map((run) => {
                const runStatus = run.status ? STATUS[run.status] : null;
                return (
                  <li key={run.id} className="flex flex-wrap gap-x-2 text-xs text-bip-muted">
                    <span className="w-40 shrink-0">{when(run.started_at)}</span>
                    <span className={runStatus?.tone ?? ""}>{runStatus?.label ?? "Unfinished"}</span>
                    <span className="text-bip-text">{run.headline}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoutinesBoard() {
  const [routines, setRoutines] = useState<RoutineView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch("/api/routines", { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; routines?: RoutineView[] };
        if (!live) return;
        if (!response.ok || !payload.routines) throw new Error(payload.error ?? "Could not load routines");
        setRoutines(payload.routines);
        setError(null);
      } catch (loadError) {
        if (live) setError(loadError instanceof Error ? loadError.message : "Could not load routines");
      }
    })();
    return () => {
      live = false;
    };
  }, [reload]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-bip-border bg-bip-card p-4">
        <h1 className="text-lg font-semibold text-bip-text">Routines</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-bip-muted">
          Things the app does on its own, on a schedule, whether or not anyone has the page open. Each one keeps a
          record of every run, so you can see what it found and whether it has been running. Routines look and
          report; none of them sends anything to a client.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!routines && !error && (
        <div className="flex items-center gap-2 text-sm text-bip-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading routines…
        </div>
      )}
      {routines?.length === 0 && <p className="text-sm text-bip-muted">No routines yet.</p>}
      {routines?.map((routine) => (
        <RoutineCard key={routine.id} routine={routine} onChanged={() => setReload((count) => count + 1)} />
      ))}
    </div>
  );
}
