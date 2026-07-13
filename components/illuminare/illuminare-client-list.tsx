import Link from "next/link";
import { Sparkles, ExternalLink } from "lucide-react";
import type {
  IlluminareClientRow,
  IlluminareClientStatus,
} from "@/lib/illuminare/types";
import {
  HEALTH_RANK,
  summarizeHealth,
  type ClientHealth,
  type HealthLevel,
} from "@/lib/illuminare/health";

const STATUS_STYLES: Record<IlluminareClientStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  onboarding: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  offboarded: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const HEALTH_META: Record<
  HealthLevel,
  { label: string; dot: string; text: string }
> = {
  attention: { label: "Needs attention", dot: "bg-rose-500", text: "text-rose-400" },
  watch: { label: "On watch", dot: "bg-amber-500", text: "text-amber-400" },
  on_track: { label: "On track", dot: "bg-emerald-500", text: "text-emerald-400" },
  inactive: { label: "Inactive", dot: "bg-zinc-500", text: "text-zinc-400" },
};

function StatusBadge({ status }: { status: IlluminareClientStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.active;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium capitalize ${style}`}
    >
      {status}
    </span>
  );
}

function SummaryChip({
  level,
  count,
}: {
  level: HealthLevel;
  count: number;
}) {
  const meta = HEALTH_META[level];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)] px-3 py-2">
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      <span className="text-lg font-semibold text-[var(--text)]">{count}</span>
      <span className="text-xs text-[var(--text-muted)]">{meta.label}</span>
    </div>
  );
}

export default function IlluminareClientList({
  clients,
  healthByClient,
  loadError,
}: {
  clients: IlluminareClientRow[];
  healthByClient: Record<number, ClientHealth>;
  loadError: string | null;
}) {
  const summary = summarizeHealth(clients.map((c) => healthByClient[c.id]).filter(Boolean));

  // Most-urgent clients first, then alphabetical within a level.
  const ordered = [...clients].sort((a, b) => {
    const ra = HEALTH_RANK[healthByClient[a.id]?.level ?? "on_track"];
    const rb = HEALTH_RANK[healthByClient[b.id]?.level ?? "on_track"];
    if (ra !== rb) return ra - rb;
    return a.account_name.localeCompare(b.account_name);
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bip-accent)]/15">
          <Sparkles size={18} className="text-[var(--bip-accent)]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Illuminare</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {clients.length} client{clients.length === 1 ? "" : "s"} · account plans,
            deliverables, and Basecamp comms
          </p>
        </div>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          Could not load clients: {loadError}
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          No Illuminare clients yet.
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryChip level="attention" count={summary.attention} />
            <SummaryChip level="watch" count={summary.watch} />
            <SummaryChip level="on_track" count={summary.onTrack} />
            <SummaryChip level="inactive" count={summary.inactive} />
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--bip-border)] text-left text-[0.7rem] uppercase tracking-wide text-[var(--text-subtle)]">
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Health</th>
                  <th className="px-4 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Website</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((client) => {
                  const health = healthByClient[client.id];
                  const meta = health ? HEALTH_META[health.level] : null;
                  return (
                    <tr
                      key={client.id}
                      className="border-b border-[var(--bip-border)] last:border-0 transition-colors hover:bg-[var(--bip-hover)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/illuminare/${client.id}`}
                          className="font-medium text-[var(--text)] hover:text-[var(--bip-accent)]"
                        >
                          {client.account_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {meta && health ? (
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                            <span className={`text-xs ${meta.text}`}>
                              {health.reasons[0] ?? meta.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-subtle)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {client.account_lead ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={client.status} />
                      </td>
                      <td className="px-4 py-3">
                        {client.website ? (
                          <a
                            href={client.website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--bip-accent)]"
                          >
                            Visit <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-[var(--text-subtle)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
