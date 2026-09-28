"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { ErrorState } from "@/components/ui/feedback";
import { ToolPage } from "@/components/ui/tool-page";
import { ACTIVE_WARNING_DAYS, isActiveWarning, type DataWarning } from "@/lib/data-integrity/warnings";

function when(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Data health: every warning that some data may be incomplete. For now, reads
 * the database cut short at its 1000-row limit; job health joins it next.
 */
export default function DataHealthView({ warnings, loadError }: { warnings: DataWarning[]; loadError: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const active = warnings.filter((w) => isActiveWarning(w, now));
  const quiet = warnings.filter((w) => w.resolved_at == null && !isActiveWarning(w, now));
  const resolved = warnings.filter((w) => w.resolved_at != null);

  async function resolve(id: number) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/data-warnings/${id}`, { method: "PATCH" });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not mark it resolved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark it resolved.");
    } finally {
      setBusy(null);
    }
  }

  const list = (items: DataWarning[], canResolve: boolean) => (
    <ul className="divide-y divide-bip-border rounded-xl border border-bip-border bg-bip-card">
      {items.map((w) => (
        <li key={w.id} className="flex items-start gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-bip-text">{w.detail}</p>
            <p className="mt-1 text-xs text-bip-muted">
              First seen {when(w.first_seen_at)} · last seen {when(w.last_seen_at)} · {w.occurrences}{" "}
              {w.occurrences === 1 ? "time" : "times"}
              {w.resolved_at && <> · resolved {when(w.resolved_at)}</>}
            </p>
          </div>
          {canResolve && (
            <button
              onClick={() => void resolve(w.id)}
              disabled={busy === w.id}
              className="shrink-0 rounded-md border border-bip-border px-2 py-1 text-xs text-bip-muted hover:text-bip-text disabled:opacity-50"
              title="Resolving it is a claim: if the same read is cut short again, it reopens by itself."
            >
              {busy === w.id ? "…" : "Mark resolved"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <ToolPage
      title="Data health"
      icon={HeartPulse}
      maxWidth="5xl"
      description="Anything that means some data may be incomplete. Every database read in the app is checked: one that returns exactly the database's 1,000-row limit was almost certainly cut short. Each is emailed to you once, shown as a banner, and blocks client report and briefing exports while active."
    >
      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-bip-muted">
              Active · seen in the last {ACTIVE_WARNING_DAYS} days ({active.length})
            </h2>
            {active.length ? list(active, true) : <p className="text-sm text-emerald-400">Nothing active. No read has been cut short recently.</p>}
          </section>
          {quiet.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-bip-muted">
                Not seen for {ACTIVE_WARNING_DAYS}+ days ({quiet.length})
              </h2>
              {list(quiet, true)}
            </section>
          )}
          {resolved.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-bip-muted">Resolved ({resolved.length})</h2>
              {list(resolved, false)}
            </section>
          )}
        </>
      )}
    </ToolPage>
  );
}
