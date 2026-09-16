"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, GraduationCap, Loader2, Plus, Settings } from "lucide-react";
import NewClientFlow from "@/components/onboarding/new-client-flow";
import OnboardingWorkspace from "@/components/onboarding/onboarding-workspace";

/**
 * Onboarding, rebuilt around what it produces (2026-09-16).
 *
 * Tom's brief: upload the pipeline form and the kickoff doc, have the research
 * run and compile, and see only what is needed for the Basecamp message and the
 * client document — not a checklist of steps to tick off.
 */

type Row = { clientId: number; accountName: string; onboardingStartedAt: string | null };
type Selection = { kind: "new" } | { kind: "client"; id: number; autoRun: boolean } | null;

export default function OnboardingHome({ initialClientId }: { initialClientId?: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(
    initialClientId ? { kind: "client", id: initialClientId, autoRun: false } : null,
  );
  const [finishing, setFinishing] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const response = await fetch("/api/clients/onboarding?status=active", { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; clients?: Row[] };
      if (!response.ok) throw new Error(payload.error ?? "Could not load onboarding clients.");
      const list = (payload.clients ?? []).map((row) => ({
        clientId: row.clientId,
        accountName: row.accountName,
        onboardingStartedAt: row.onboardingStartedAt,
      }));
      setRows(list);
      setSelection((current) => current ?? (list[0] ? { kind: "client", id: list[0].clientId, autoRun: false } : { kind: "new" }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load onboarding clients.");
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function finish(clientId: number) {
    setFinishing(true);
    try {
      await fetch(`/api/clients/${clientId}/onboarding/finish`, { method: "POST" });
      setSelection(null);
      await loadList();
    } finally {
      setFinishing(false);
    }
  }

  const selectedId = selection?.kind === "client" ? selection.id : null;

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-bip-text">
            <GraduationCap className="h-5 w-5 text-bip-accent" /> Onboarding
          </h1>
          <p className="mt-1 text-sm text-bip-muted">
            Upload the pipeline form, check the details, and research runs itself. You get the Basecamp message and the client
            document at the end.
          </p>
        </div>
        <Link href="/onboarding-settings" className="inline-flex items-center gap-1 text-xs text-bip-muted hover:text-bip-text">
          <Settings className="h-3.5 w-3.5" /> Message template
        </Link>
      </header>

      <div className="grid gap-5 md:grid-cols-[230px_1fr]">
        <aside className="space-y-2">
          <button
            type="button"
            onClick={() => setSelection({ kind: "new" })}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              selection?.kind === "new"
                ? "border-bip-accent bg-bip-accent/10 text-bip-accent"
                : "border-bip-border bg-bip-card text-bip-text hover:bg-bip-fill"
            }`}
          >
            <Plus className="h-4 w-4" /> New client
          </button>

          <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-bip-muted">Onboarding now</p>
          {error && <p className="px-1 text-xs text-red-400">{error}</p>}
          {!rows ? (
            <p className="flex items-center gap-2 px-1 text-xs text-bip-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </p>
          ) : rows.length === 0 ? (
            <p className="px-1 text-xs text-bip-muted">No one is being onboarded.</p>
          ) : (
            <ul className="space-y-1">
              {rows.map((row) => (
                <li key={row.clientId}>
                  <button
                    type="button"
                    onClick={() => setSelection({ kind: "client", id: row.clientId, autoRun: false })}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                      selectedId === row.clientId ? "bg-bip-fill font-medium text-bip-text" : "text-bip-text hover:bg-bip-fill/60"
                    }`}
                  >
                    <span className="block truncate">{row.accountName}</span>
                    {row.onboardingStartedAt && (
                      <span className="text-[11px] text-bip-muted">
                        since {new Date(row.onboardingStartedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="min-w-0">
          {selection?.kind === "new" && (
            <NewClientFlow
              onCreated={(clientId) => {
                setSelection({ kind: "client", id: clientId, autoRun: true });
                void loadList();
              }}
            />
          )}
          {selection?.kind === "client" && (
            <div className="space-y-3">
              {/* Keyed by client: switching clients starts a fresh workspace. */}
              <OnboardingWorkspace key={selection.id} clientId={selection.id} autoRun={selection.autoRun} />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={finishing}
                  onClick={() => void finish(selection.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-bip-border px-3 py-1.5 text-xs text-bip-text hover:bg-bip-fill disabled:opacity-60"
                  title="Posted the Basecamp message and sent the document? Take them off this list."
                >
                  {finishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Onboarding done
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
