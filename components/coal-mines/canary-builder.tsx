"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Trash2,
} from "lucide-react";

/**
 * Writing a canary by describing it.
 *
 * The shape of this screen is an argument: you do not save a check, you save a
 * check you have already seen the results of. Everything between "Draft it" and
 * "Save" exists so the question "did it understand me?" is answerable without
 * reading SQL — a plain-English restatement, the assumptions it had to make,
 * and the actual rows it found just now.
 */

type Draft = {
  name: string;
  watches: string;
  sql: string;
  headlineNone: string;
  headlineSome: string;
  itemLabelColumn: string;
  itemMetaColumns: string[];
  hrefTemplate: string | null;
  severity: "attention" | "overdue";
  understanding: string;
  caveats: string[];
};

type Preview = {
  rows: Record<string, unknown>[];
  columns: string[];
  error: string | null;
  ms: number;
  limit: number;
};

export type SavedCanary = {
  id: number;
  name: string;
  watches: string;
  instruction: string;
  severity: "attention" | "overdue";
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_finding_count: number | null;
  last_error: string | null;
};

const EXAMPLES = [
  "Tell me when a client paying for Blog hasn't had a post in 45 days",
  "Which clients have been mid-onboarding for more than 60 days?",
  "Clients paying for PPC whose ads spent nothing last month",
  "Clients with no city set — it quietly degrades their keywords",
];

function statusTone(status: string | null) {
  if (status === "error") return { text: "text-red-300", label: "Broken", Icon: AlertTriangle };
  if (status === "overdue") return { text: "text-red-300", label: "Needs doing", Icon: AlertTriangle };
  if (status === "attention")
    return { text: "text-amber-300", label: "Worth a look", Icon: CircleAlert };
  if (status === "ok") return { text: "text-emerald-400", label: "All clear", Icon: CheckCircle2 };
  return { text: "text-bip-muted", label: "Not run yet", Icon: CircleAlert };
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function CanaryBuilder({ canaries }: { canaries: SavedCanary[] }) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function runDraft() {
    setDrafting(true);
    setError(null);
    setDraft(null);
    setPreview(null);
    try {
      const res = await fetch("/api/coal-mines/canaries/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Could not draft this check.");
        if (payload.draft) setDraft(payload.draft);
        return;
      }
      setDraft(payload.draft);
      setPreview(payload.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft this check.");
    } finally {
      setDrafting(false);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/coal-mines/canaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, instruction }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Could not save.");
        return;
      }
      setDraft(null);
      setPreview(null);
      setInstruction("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function update(id: number, patch: Record<string, unknown>) {
    setBusyId(id);
    try {
      await fetch(`/api/coal-mines/canaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number, name: string) {
    if (!window.confirm(`Delete "${name}"? Its history goes with it.`)) return;
    setBusyId(id);
    try {
      await fetch(`/api/coal-mines/canaries/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <h2 className="text-sm font-semibold text-bip-text">Describe what you want watched</h2>
        <p className="mt-0.5 text-xs text-bip-muted">
          In your own words. It will write the check, run it once, and show you what it found
          before you save anything.
        </p>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          placeholder="Tell me when…"
          className="mt-3 w-full rounded-md border border-bip-border bg-bip-bg px-3 py-2 text-sm text-bip-text placeholder:text-bip-muted focus:outline-none focus:ring-1 focus:ring-bip-accent"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInstruction(example)}
              className="rounded-full border border-bip-border px-2.5 py-1 text-[11px] text-bip-muted hover:text-bip-text"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={drafting || !instruction.trim()}
            onClick={() => void runDraft()}
            className="inline-flex items-center gap-1.5 rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {drafting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {drafting ? "Writing the check…" : "Draft it"}
          </button>
          {error && <span className="text-[11px] text-red-300">{error}</span>}
        </div>
      </section>

      {draft && (
        <section className="rounded-xl border border-bip-accent/40 bg-bip-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-md border border-transparent bg-transparent text-sm font-semibold text-bip-text hover:border-bip-border focus:border-bip-border focus:outline-none"
              />
              <textarea
                value={draft.watches}
                onChange={(e) => setDraft({ ...draft, watches: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md border border-transparent bg-transparent text-xs text-bip-muted hover:border-bip-border focus:border-bip-border focus:outline-none"
              />
            </div>
            <select
              value={draft.severity}
              onChange={(e) =>
                setDraft({ ...draft, severity: e.target.value as "attention" | "overdue" })
              }
              className="rounded-md border border-bip-border bg-bip-bg px-2 py-1 text-[11px] text-bip-text"
            >
              <option value="attention">Worth a look</option>
              <option value="overdue">Needs doing</option>
            </select>
          </div>

          <div className="mt-3 border-t border-bip-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
              What it will look for
            </p>
            <p className="mt-1 text-xs leading-relaxed text-bip-text">{draft.understanding}</p>
          </div>

          {draft.caveats.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
              <p className="text-[11px] font-semibold text-amber-300">
                Assumptions it had to make
              </p>
              <ul className="mt-1 space-y-0.5">
                {draft.caveats.map((caveat) => (
                  <li key={caveat} className="text-[11px] leading-relaxed text-bip-muted">
                    • {caveat}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview && (
            <div className="mt-3 border-t border-bip-border pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-bip-muted">
                What it finds right now
              </p>
              {preview.error ? (
                <p className="mt-1 text-xs text-red-300">{preview.error}</p>
              ) : preview.rows.length === 0 ? (
                <p className="mt-1 text-xs text-emerald-400">
                  Nothing — which is the all-clear. Worth checking that is really true before you
                  save it.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-bip-text">
                    {preview.rows.length}
                    {preview.rows.length >= preview.limit ? "+" : ""} found in {preview.ms}ms.
                  </p>
                  <div className="mt-2 max-h-72 overflow-auto rounded-md border border-bip-border">
                    <table className="w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-bip-bg">
                        <tr>
                          {preview.columns.map((column) => (
                            <th
                              key={column}
                              className="whitespace-nowrap px-2 py-1.5 font-medium text-bip-muted"
                            >
                              {column.replace(/_/g, " ")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, i) => (
                          <tr key={i} className="border-t border-bip-border">
                            {preview.columns.map((column) => (
                              <td
                                key={column}
                                className="whitespace-nowrap px-2 py-1.5 text-bip-text"
                              >
                                {formatCell(row[column])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          <details className="mt-3 border-t border-bip-border pt-3">
            <summary className="cursor-pointer text-[11px] text-bip-muted">
              The query it wrote
            </summary>
            <pre className="mt-2 overflow-auto rounded-md bg-bip-bg p-2.5 text-[11px] leading-relaxed text-bip-muted">
              {draft.sql}
            </pre>
          </details>

          <div className="mt-3 flex items-center gap-2 border-t border-bip-border pt-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-md bg-bip-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save this canary"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setPreview(null);
              }}
              className="text-[11px] text-bip-muted hover:text-bip-text"
            >
              Discard
            </button>
            <span className="text-[11px] text-bip-muted">
              It will appear on the Coal Mines board and re-run whenever the board is opened.
            </span>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-bip-border bg-bip-card p-4">
        <h2 className="text-sm font-semibold text-bip-text">
          Your canaries {canaries.length > 0 && `(${canaries.length})`}
        </h2>
        {canaries.length === 0 ? (
          <p className="mt-1 text-xs text-bip-muted">
            None yet. The four built-in canaries on the board are not listed here — they are part
            of the app.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {canaries.map((canary) => {
              const tone = statusTone(canary.last_status);
              return (
                <li
                  key={canary.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-t border-bip-border pt-2.5 first:border-0 first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <tone.Icon className={`h-3.5 w-3.5 shrink-0 ${tone.text}`} />
                      <span
                        className={`truncate text-xs font-medium ${
                          canary.enabled ? "text-bip-text" : "text-bip-muted line-through"
                        }`}
                      >
                        {canary.name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-bip-muted">{canary.watches}</p>
                    <p className="mt-0.5 text-[11px] text-bip-muted">
                      <span className={tone.text}>{tone.label}</span>
                      {canary.last_finding_count != null && canary.last_status !== "error"
                        ? ` · ${canary.last_finding_count} found`
                        : ""}
                      {canary.last_run_at
                        ? ` · checked ${new Date(canary.last_run_at).toLocaleString()}`
                        : ""}
                    </p>
                    {canary.last_error && (
                      <p className="mt-0.5 text-[11px] text-red-300">{canary.last_error}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === canary.id}
                      onClick={() => void update(canary.id, { enabled: !canary.enabled })}
                      className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-bip-text disabled:opacity-50"
                    >
                      {canary.enabled ? (
                        <>
                          <Pause className="h-3 w-3" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" /> Resume
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === canary.id}
                      onClick={() => void remove(canary.id, canary.name)}
                      className="inline-flex items-center gap-1 text-[11px] text-bip-muted hover:text-red-300 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
