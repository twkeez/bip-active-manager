"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bird,
  CheckCircle2,
  CircleAlert,
  Clock,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Repeat,
  XCircle,
} from "lucide-react";
import type { Canary, CanaryStatus } from "@/lib/coal-mines/canaries";
import type { RoutineView } from "@/lib/routines/load";
import type { RoutineFinding, RoutineStatus } from "@/lib/routines/types";
import CanaryBody from "./canary-body";
import ClassifyThreadsButton from "./classify-threads-button";

/**
 * Coal Mines, in three panels.
 *
 * Left: everything that watches — routines, which run on a schedule, and
 * canaries, which are checked when the page opens. Middle: what the selected
 * one found, which is the only thing that should compete for attention. Right:
 * what it is and how it is set up — the instruction it was given, its schedule,
 * its settings, its history — for when the finding raises a question.
 *
 * The selection lives in the address (?item=…) so a link to one routine's
 * morning results can be shared, and the back button behaves.
 */

type Tone = "ok" | "attention" | "overdue" | "error" | "none";

const DOT: Record<Tone, string> = {
  ok: "bg-emerald-500",
  attention: "bg-amber-500",
  overdue: "bg-red-500",
  error: "bg-red-500",
  none: "bg-bip-border",
};

const CANARY_TONE: Record<CanaryStatus, { icon: typeof CheckCircle2; text: string; label: string }> = {
  ok: { icon: CheckCircle2, text: "text-emerald-600", label: "All clear" },
  attention: { icon: CircleAlert, text: "text-amber-600", label: "Worth a look" },
  overdue: { icon: AlertTriangle, text: "text-red-500", label: "Needs doing" },
};

const ROUTINE_TONE: Record<RoutineStatus, { icon: typeof CheckCircle2; text: string; label: string }> = {
  ok: { icon: CheckCircle2, text: "text-emerald-600", label: "All clear" },
  attention: { icon: CircleAlert, text: "text-amber-600", label: "Needs attention" },
  error: { icon: XCircle, text: "text-red-500", label: "Failed" },
};

/** Labels for routine settings a person can change, by setting name. */
const SETTING_LABELS: Record<string, { label: string; unit: string }> = {
  replyAfterDays: { label: "Needs a reply after", unit: "days" },
  quietAfterDays: { label: "Counts as quiet after", unit: "days" },
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

function ago(iso: string | null): string {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Left: the list
// ---------------------------------------------------------------------------

function ListItem({
  selected,
  tone,
  title,
  subtitle,
  onSelect,
}: {
  selected: boolean;
  tone: Tone;
  title: string;
  subtitle: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
        selected ? "bg-bip-fill" : "hover:bg-bip-fill/60"
      }`}
    >
      <span aria-hidden className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-bip-text">{title}</span>
        <span className="block truncate text-[11px] text-bip-muted">{subtitle}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Middle: what a routine found
// ---------------------------------------------------------------------------

function RoutineFindings({ findings }: { findings: RoutineFinding[] }) {
  const groups = new Map<string, RoutineFinding[]>();
  for (const finding of findings) groups.set(finding.group, [...(groups.get(finding.group) ?? []), finding]);
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([group, items]) => (
        <section key={group} className="rounded-lg border border-bip-border p-3">
          <p className="text-sm font-semibold text-bip-text">
            {group} <span className="font-normal text-bip-muted">({items.length})</span>
          </p>
          <ul className="mt-2 divide-y divide-bip-border">
            {items.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-start gap-2.5 py-2">
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
                      className="inline-flex items-center gap-1 text-sm text-bip-text hover:underline"
                    >
                      {item.label} <ExternalLink className="h-3 w-3 shrink-0 text-bip-muted" />
                    </a>
                  ) : (
                    <span className="text-sm text-bip-text">{item.label}</span>
                  )}
                  <p className="text-xs text-bip-muted">{item.meta}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right: a routine's set-up and history
// ---------------------------------------------------------------------------

/** Choosing which clients a watch routine covers. */
function ClientPicker({
  clients,
  chosen,
  onToggle,
}: {
  clients: Array<{ id: number; account_name: string }>;
  chosen: number[];
  onToggle: (id: number) => void;
}) {
  const [filter, setFilter] = useState("");
  const shown = clients.filter((client) =>
    client.account_name.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  return (
    <div className="mt-2">
      <input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Find a client…"
        className="w-full rounded border border-bip-border bg-bip-card px-2 py-1 text-xs text-bip-text focus:border-bip-accent focus:outline-none"
      />
      <div className="mt-1.5 max-h-56 overflow-y-auto rounded border border-bip-border">
        {shown.length === 0 && <p className="px-2 py-1.5 text-xs text-bip-muted">No client matches.</p>}
        {shown.map((client) => (
          <label
            key={client.id}
            className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs text-bip-text hover:bg-bip-fill"
          >
            <input
              type="checkbox"
              checked={chosen.includes(client.id)}
              onChange={() => onToggle(client.id)}
              className="h-3 w-3 accent-bip-accent"
            />
            <span className="truncate">{client.account_name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function RoutineInfo({
  routine,
  clients,
  onChanged,
}: {
  routine: RoutineView;
  clients: Array<{ id: number; account_name: string }>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"run" | "toggle" | "settings" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // In the order they are listed above, not the database's key order.
  const editable = Object.keys(SETTING_LABELS).filter((key) => key in (routine.settings ?? {}));
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(editable.map((key) => [key, String(routine.settings[key] ?? "")])),
  );
  const watches = Array.isArray(routine.settings.clientIds);
  const [clientIds, setClientIds] = useState<number[]>(
    watches ? (routine.settings.clientIds as number[]).map(Number) : [],
  );
  const clientsChanged =
    watches &&
    JSON.stringify([...clientIds].sort()) !==
      JSON.stringify([...(routine.settings.clientIds as number[])].map(Number).sort());
  const dirty =
    editable.some((key) => draft[key] !== String(routine.settings[key] ?? "")) || clientsChanged;

  async function send(kind: "run" | "toggle" | "settings") {
    setBusy(kind);
    setError(null);
    try {
      const response =
        kind === "run"
          ? await fetch(`/api/routines/${routine.id}/run`, { method: "POST" })
          : await fetch(`/api/routines/${routine.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                kind === "toggle"
                  ? { enabled: !routine.enabled }
                  : {
                      settings: {
                        ...Object.fromEntries(editable.map((key) => [key, Number(draft[key])])),
                        ...(watches ? { clientIds } : {}),
                      },
                    },
              ),
            });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "That did not work");
      onChanged();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "That did not work");
    } finally {
      setBusy(null);
    }
  }

  const settingsValid = editable.every((key) => {
    const value = Number(draft[key]);
    return Number.isInteger(value) && value >= 1 && value <= 365;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void send("run")}
          className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy === "run" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Run now
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void send("toggle")}
          className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill disabled:opacity-50"
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
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Asked for</p>
        <p className="mt-1 text-sm italic leading-relaxed text-bip-text">&ldquo;{routine.instruction}&rdquo;</p>
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Schedule</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-bip-text">
          <Clock className="h-3.5 w-3.5 text-bip-muted" /> {routine.scheduleText}
        </p>
        <p className="mt-0.5 text-xs text-bip-muted">
          {routine.enabled ? `Next run ${when(routine.nextRunAt)}` : "Paused — it will not run until resumed."}
        </p>
      </section>

      {watches && (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
            Clients watched ({clientIds.length})
          </p>
          <ClientPicker
            clients={clients}
            chosen={clientIds}
            onToggle={(id) =>
              setClientIds((current) =>
                current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
              )
            }
          />
        </section>
      )}

      {(editable.length > 0 || watches) && (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Settings</p>
          <div className="mt-2 space-y-2">
            {editable.map((key) => (
              <label key={key} className="flex items-center justify-between gap-3 text-sm text-bip-text">
                <span>{SETTING_LABELS[key].label}</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={draft[key] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                    className="w-16 rounded border border-bip-border bg-bip-card px-2 py-1 text-right text-sm text-bip-text focus:border-bip-accent focus:outline-none"
                  />
                  <span className="text-xs text-bip-muted">{SETTING_LABELS[key].unit}</span>
                </span>
              </label>
            ))}
          </div>
          {dirty && (
            <button
              type="button"
              disabled={busy !== null || !settingsValid}
              onClick={() => void send("settings")}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy === "settings" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save — applies from the next run
            </button>
          )}
        </section>
      )}

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">History</p>
        {routine.runs.length === 0 ? (
          <p className="mt-1 text-xs text-bip-muted">No runs yet.</p>
        ) : (
          <ul className="mt-1.5 space-y-2">
            {routine.runs.map((run) => {
              const tone = run.status ? ROUTINE_TONE[run.status] : null;
              return (
                <li key={run.id} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-bip-text">{when(run.started_at)}</span>
                    <span className={tone?.text ?? "text-amber-600"}>
                      {tone?.label ?? "Did not finish"}
                    </span>
                  </div>
                  <p className="text-bip-muted">
                    {run.trigger === "manual" ? "By hand · " : ""}
                    {run.headline}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The workspace
// ---------------------------------------------------------------------------

type Selection = { type: "routine"; routine: RoutineView } | { type: "canary"; canary: Canary };

export default function CoalMinesWorkspace({
  canaries,
  routines,
  routinesError,
  clients,
  checkedAt,
}: {
  canaries: Canary[];
  routines: RoutineView[];
  routinesError: string | null;
  /** For routines that watch a chosen list of clients. */
  clients: Array<{ id: number; account_name: string }>;
  checkedAt: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Default to whatever most needs a look, so opening the page answers
  // "anything wrong?" without a click.
  const defaultKey = useMemo(() => {
    const routine = routines.find((item) => item.runs[0]?.status === "attention" || item.runs[0]?.status === "error");
    if (routine) return `routine:${routine.key}`;
    const canary =
      canaries.find((item) => item.status === "overdue") ?? canaries.find((item) => item.status === "attention");
    if (canary) return `canary:${canary.key}`;
    if (routines[0]) return `routine:${routines[0].key}`;
    return canaries[0] ? `canary:${canaries[0].key}` : null;
  }, [canaries, routines]);

  const selectedKey = params.get("item") ?? defaultKey;
  const selection: Selection | null = useMemo(() => {
    if (!selectedKey) return null;
    const [type, ...rest] = selectedKey.split(":");
    const key = rest.join(":");
    if (type === "routine") {
      const routine = routines.find((item) => item.key === key);
      return routine ? { type: "routine", routine } : null;
    }
    const canary = canaries.find((item) => item.key === key);
    return canary ? { type: "canary", canary } : null;
  }, [selectedKey, routines, canaries]);

  // The native history API, not router.replace: Next keeps useSearchParams in
  // sync with it, and it does not send the page back to the server — which
  // would re-run every canary on each click and take seconds.
  const select = (key: string) => {
    window.history.pushState(null, "", `${pathname}?item=${encodeURIComponent(key)}`);
    // Bring what was picked into view: on a wide screen the heading of the
    // middle panel, on a phone the panel itself, which sits below the list.
    requestAnimationFrame(() =>
      document.getElementById("coal-mines-detail")?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  };
  const refresh = () => router.refresh();

  const noisy = canaries.filter((canary) => canary.status !== "ok").length;

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
      {/* ------------------------------------------------------------------ */}
      <aside className="rounded-xl border border-bip-border bg-bip-card p-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto">
        <div className="flex items-center gap-2 px-1">
          <Bird className="h-4 w-4 text-bip-accent" />
          <h1 className="text-base font-semibold text-bip-text">Coal Mines</h1>
        </div>
        <p className="mt-0.5 px-1 text-[11px] text-bip-muted">
          {noisy === 0 ? "All canaries quiet." : `${noisy} of ${canaries.length} canaries want attention.`}
        </p>

        <p className="mt-4 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
          <Repeat className="h-3 w-3" /> Routines
        </p>
        <p className="px-1 text-[10.5px] text-bip-muted">Run on a schedule.</p>
        <div className="mt-1 space-y-0.5">
          {routinesError && <p className="px-2.5 py-1 text-xs text-red-500">{routinesError}</p>}
          {routines.map((routine) => {
            const latest = routine.runs[0];
            return (
              <ListItem
                key={routine.key}
                selected={selection?.type === "routine" && selection.routine.key === routine.key}
                tone={!routine.enabled ? "none" : (latest?.status ?? "none")}
                title={routine.name}
                subtitle={
                  !routine.enabled
                    ? "Paused"
                    : latest
                      ? `${ago(latest.started_at)} · ${latest.headline ?? ""}`
                      : `First run ${when(routine.nextRunAt)}`
                }
                onSelect={() => select(`routine:${routine.key}`)}
              />
            );
          })}
        </div>

        <p className="mt-4 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
          <Bird className="h-3 w-3" /> Canaries
        </p>
        <p className="px-1 text-[10.5px] text-bip-muted">Checked when this page opens.</p>
        <div className="mt-1 space-y-0.5">
          {canaries.map((canary) => (
            <ListItem
              key={canary.key}
              selected={selection?.type === "canary" && selection.canary.key === canary.key}
              tone={canary.status}
              title={canary.name}
              subtitle={canary.headline}
              onSelect={() => select(`canary:${canary.key}`)}
            />
          ))}
        </div>

        <div className="mt-4 border-t border-bip-border px-1 pt-3">
          <Link href="/coal-mines/bots" className="text-xs font-medium text-bip-text hover:underline">
            Write a canary →
          </Link>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      <main
        id="coal-mines-detail"
        className="min-w-0 scroll-mt-4 rounded-xl border border-bip-border bg-bip-card p-5"
      >
        {!selection ? (
          <p className="text-sm text-bip-muted">Pick a routine or canary on the left.</p>
        ) : selection.type === "routine" ? (
          (() => {
            const routine = selection.routine;
            const latest = routine.runs[0];
            const tone = latest?.status ? ROUTINE_TONE[latest.status] : null;
            const Icon = tone?.icon;
            return (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-bip-text">{routine.name}</h2>
                  {latest && (
                    <span className="text-[11px] text-bip-muted">
                      {latest.trigger === "manual" ? "Run by hand" : "Scheduled run"} · {when(latest.started_at)}
                    </span>
                  )}
                </div>
                {!latest ? (
                  <p className="mt-3 text-sm text-bip-muted">
                    Has not run yet. It runs {routine.scheduleText.toLowerCase()}, or use Run now on the right.
                  </p>
                ) : (
                  <>
                    <p className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium ${tone?.text ?? ""}`}>
                      {Icon && <Icon className="h-4 w-4" />} {latest.headline}
                    </p>
                    {!latest.finished_at && (
                      <p className="mt-1 text-xs text-amber-600">This run did not finish — it stopped part-way.</p>
                    )}
                    {latest.error_message && <p className="mt-1 text-xs text-red-500">{latest.error_message}</p>}
                    <div className="mt-4">
                      {latest.findings.length > 0 ? (
                        <RoutineFindings findings={latest.findings} />
                      ) : (
                        <p className="text-sm text-bip-muted">Nothing to act on this time.</p>
                      )}
                    </div>
                  </>
                )}
              </>
            );
          })()
        ) : (
          (() => {
            const canary = selection.canary;
            const tone = CANARY_TONE[canary.status];
            const Icon = tone.icon;
            return (
              <>
                <h2 className="text-lg font-semibold text-bip-text">{canary.name}</h2>
                <p className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium ${tone.text}`}>
                  <Icon className="h-4 w-4" /> {canary.headline}
                </p>
                <div className="mt-4">
                  <CanaryBody canary={canary} />
                </div>
              </>
            );
          })()
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      <aside className="rounded-xl border border-bip-border bg-bip-card p-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto">
        {!selection ? null : selection.type === "routine" ? (
          <RoutineInfo
            key={`${selection.routine.key}-${selection.routine.updated_at}`}
            routine={selection.routine}
            clients={clients}
            onChanged={refresh}
          />
        ) : (
          <div className="space-y-5">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Watches</p>
              <p className="mt-1 text-sm leading-relaxed text-bip-text">{selection.canary.watches}</p>
            </section>
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Checked</p>
              <p className="mt-1 text-sm text-bip-text">{when(checkedAt)}</p>
              <p className="mt-0.5 text-xs text-bip-muted">
                Canaries look again each time this page opens. They report only — nothing here changes anything.
              </p>
            </section>
            {selection.canary.action && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Fix it</p>
                <Link
                  href={selection.canary.action.href}
                  className="mt-1 inline-block text-sm font-medium text-bip-text hover:underline"
                >
                  {selection.canary.action.label} →
                </Link>
              </section>
            )}
            {selection.canary.key === "basecamp-threads" && (
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Threads</p>
                <div className="mt-1.5">
                  <ClassifyThreadsButton />
                </div>
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
