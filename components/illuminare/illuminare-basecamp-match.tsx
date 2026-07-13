"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Link2, RefreshCw, Wand2 } from "lucide-react";
import type {
  IlluminareMatchStatus,
  IlluminareProjectMatch,
} from "@/lib/illuminare/basecamp-match";

type ProjectOption = { id: string; name: string };

const STATUS_META: Record<
  IlluminareMatchStatus,
  { label: string; className: string }
> = {
  already_set: { label: "Linked", className: "text-emerald-400" },
  matched: { label: "Suggested", className: "text-sky-400" },
  conflict: { label: "Conflict", className: "text-amber-400" },
  ambiguous: { label: "Ambiguous", className: "text-amber-400" },
  missing: { label: "No match", className: "text-[var(--text-subtle)]" },
};

export default function IlluminareBasecampMatch({
  projects,
  matches,
  unmatched,
  loadError,
}: {
  projects: ProjectOption[];
  matches: IlluminareProjectMatch[];
  unmatched: ProjectOption[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<
    { clientId: number; projectId: string; error: string }[]
  >([]);

  // Selected project id per client, seeded from the current link.
  const [selection, setSelection] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (const m of matches) initial[m.clientId] = m.currentProjectId ?? "";
    return initial;
  });

  const suggestionCount = matches.filter(
    (m) => m.status === "matched" && selection[m.clientId] !== m.suggestedProjectId,
  ).length;

  function applyAllSuggestions() {
    setSelection((prev) => {
      const next = { ...prev };
      for (const m of matches) {
        if (m.suggestedProjectId && (m.status === "matched" || m.status === "conflict")) {
          next[m.clientId] = m.suggestedProjectId;
        }
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSavedCount(null);
    try {
      const assignments = matches
        .filter((m) => (selection[m.clientId] ?? "") !== (m.currentProjectId ?? ""))
        .map((m) => ({
          clientId: m.clientId,
          projectId: selection[m.clientId] || null,
        }));
      if (assignments.length === 0) {
        setSavedCount(0);
        return;
      }
      const res = await fetch("/api/illuminare/basecamp/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      const data = (await res.json()) as { updated: number };
      setSavedCount(data.updated);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function syncComms() {
    setSyncing(true);
    setSyncMsg(null);
    setSyncErrors([]);
    setError(null);
    try {
      const res = await fetch("/api/illuminare/basecamp/sync", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        clientsSynced?: number;
        eventsUpserted?: number;
        errors?: { clientId: number; projectId: string; error: string }[];
      };
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      const errs = Array.isArray(data.errors) ? data.errors : [];
      setSyncErrors(errs);
      setSyncMsg(
        `Synced ${data.clientsSynced ?? 0} client(s), ${data.eventsUpserted ?? 0} event(s)` +
          (errs.length > 0 ? ` · ${errs.length} project(s) had errors` : ""),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
        Couldn&apos;t load Basecamp projects: {loadError}
        <div className="mt-2 text-xs text-[var(--text-muted)]">
          If this says &quot;not connected,&quot; connect Basecamp from the Illuminare
          page first.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">
          {projects.length} Basecamp project{projects.length === 1 ? "" : "s"} found
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={applyAllSuggestions}
            disabled={suggestionCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bip-border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bip-hover)] disabled:opacity-40"
          >
            <Wand2 size={14} /> Apply {suggestionCount} suggestion
            {suggestionCount === 1 ? "" : "s"}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[var(--bip-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save links"}
          </button>
          <button
            onClick={syncComms}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bip-border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bip-hover)] disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync comms"}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          {syncMsg}
        </div>
      )}
      {syncErrors.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <p className="mb-1 font-semibold">Sync errors:</p>
          <ul className="flex flex-col gap-1">
            {syncErrors.slice(0, 12).map((e) => (
              <li key={`${e.clientId}-${e.projectId}`} className="font-mono">
                project {e.projectId}: {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      )}
      {savedCount != null && !error && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          {savedCount === 0 ? "No changes to save." : `Saved ${savedCount} link${savedCount === 1 ? "" : "s"}.`}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--bip-border)] text-left text-[0.7rem] uppercase tracking-wide text-[var(--text-subtle)]">
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Match</th>
              <th className="px-4 py-3 font-semibold">Linked project</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const meta = STATUS_META[m.status];
              return (
                <tr
                  key={m.clientId}
                  className="border-b border-[var(--bip-border)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-[var(--text)]">
                    {m.accountName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${meta.className}`}>
                      {m.status === "conflict" || m.status === "ambiguous" ? (
                        <AlertTriangle size={12} />
                      ) : (
                        <Link2 size={12} />
                      )}
                      {meta.label}
                      {m.suggestedProjectName &&
                        (m.status === "matched" || m.status === "conflict") && (
                          <span className="text-[var(--text-subtle)]">
                            → {m.suggestedProjectName}
                          </span>
                        )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={selection[m.clientId] ?? ""}
                      onChange={(e) =>
                        setSelection((prev) => ({
                          ...prev,
                          [m.clientId]: e.target.value,
                        }))
                      }
                      className="w-full max-w-xs rounded-md border border-[var(--bip-border)] bg-[var(--bip-bg)] px-2 py-1.5 text-sm text-[var(--text)] focus:border-[var(--bip-accent)] focus:outline-none"
                    >
                      <option value="">— none —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {unmatched.length > 0 && (
        <div>
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
            Basecamp projects with no client match ({unmatched.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unmatched.map((p) => (
              <span
                key={p.id}
                className="rounded-full border border-[var(--bip-border)] px-2.5 py-1 text-xs text-[var(--text-muted)]"
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
