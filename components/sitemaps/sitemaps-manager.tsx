"use client";

import { useState, useMemo, useTransition } from "react";
import { RefreshCw, ExternalLink, Search, X } from "lucide-react";
import type { SitemapRow } from "@/app/(app)/sitemaps/page";
import type { SitemapSnapshot } from "@/lib/types/client";

// ─── Status ──────────────────────────────────────────────────────────────────

type Status = "fresh" | "aging" | "stale" | "no-dates" | "error" | "unchecked";

const STATUS_ORDER: Status[] = ["error", "stale", "aging", "no-dates", "unchecked", "fresh"];

const STATUS_LABEL: Record<Status, string> = {
  fresh: "Fresh",
  aging: "Aging",
  stale: "Stale",
  "no-dates": "No dates",
  error: "Error",
  unchecked: "Not checked",
};

const STATUS_CLASSES: Record<Status, string> = {
  fresh: "bg-[var(--success-bg)] text-[var(--success-fg)]",
  aging: "bg-[var(--warning-bg)] text-[var(--warning-fg)]",
  stale: "bg-[var(--danger-bg)] text-[var(--danger-fg)]",
  "no-dates": "bg-[var(--surface-2)] text-[var(--text-muted)]",
  error: "bg-[var(--danger-bg)] text-[var(--danger-fg)]",
  unchecked: "bg-[var(--surface-2)] text-[var(--text-subtle)]",
};

function getStatus(snapshot: SitemapSnapshot | null): Status {
  if (!snapshot) return "unchecked";
  if (snapshot.run_status === "failed") return "error";
  if (!snapshot.latest_lastmod) return "no-dates";
  const ageMs = Date.now() - new Date(snapshot.latest_lastmod).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 30) return "fresh";
  if (ageDays < 90) return "aging";
  return "stale";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function absoluteDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeWebsite(raw: string | null): string {
  if (!raw) return "";
  const v = raw.trim();
  return v.includes("://") ? v : `https://${v}`;
}

// ─── Sync state ───────────────────────────────────────────────────────────────

type SyncState = "idle" | "syncing" | "done" | "error";

type LiveSnapshot = SitemapSnapshot & { _error?: string };

// ─── Component ───────────────────────────────────────────────────────────────

const ALL_STATUSES: (Status | "all")[] = ["all", "error", "stale", "aging", "no-dates", "unchecked", "fresh"];

export default function SitemapsManager({ rows }: { rows: SitemapRow[] }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [syncState, setSyncState] = useState<Record<number, SyncState>>({});
  const [liveSnapshots, setLiveSnapshots] = useState<Record<number, LiveSnapshot>>({});
  const [, startTransition] = useTransition();

  const enrichedRows = useMemo(() => {
    return rows.map((row) => ({
      ...row,
      snapshot: liveSnapshots[row.client.id] ?? row.snapshot,
    }));
  }, [rows, liveSnapshots]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enrichedRows
      .filter((row) => {
        if (q && !row.client.account_name.toLowerCase().includes(q)) return false;
        if (filterStatus !== "all" && getStatus(row.snapshot) !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => {
        const sa = STATUS_ORDER.indexOf(getStatus(a.snapshot));
        const sb = STATUS_ORDER.indexOf(getStatus(b.snapshot));
        if (sa !== sb) return sa - sb;
        return a.client.account_name.localeCompare(b.client.account_name);
      });
  }, [enrichedRows, search, filterStatus]);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<Status | "all", number>> = { all: enrichedRows.length };
    for (const row of enrichedRows) {
      const s = getStatus(row.snapshot);
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [enrichedRows]);

  async function syncClient(clientId: number) {
    setSyncState((prev) => ({ ...prev, [clientId]: "syncing" }));
    try {
      const res = await fetch("/api/sitemaps/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = (await res.json()) as { snapshot?: SitemapSnapshot; error?: string };
      if (!res.ok || !data.snapshot) {
        throw new Error(data.error ?? "Sync failed");
      }
      startTransition(() => {
        setLiveSnapshots((prev) => ({ ...prev, [clientId]: data.snapshot! }));
        setSyncState((prev) => ({ ...prev, [clientId]: "done" }));
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      startTransition(() => {
        setLiveSnapshots((prev) => ({
          ...prev,
          [clientId]: {
            id: -1,
            client_id: clientId,
            sitemap_url: "",
            fetched_at: new Date().toISOString(),
            run_status: "failed",
            error_message: msg,
            url_count: 0,
            with_lastmod_count: 0,
            latest_lastmod: null,
            stale_90_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            _error: msg,
          },
        }));
        setSyncState((prev) => ({ ...prev, [clientId]: "error" }));
      });
    }
  }

  const activeCount = Object.values(syncState).filter((s) => s === "syncing").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text)]">Sitemaps</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {enrichedRows.length} clients with a website
            {activeCount > 0 && ` · syncing ${activeCount}…`}
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        {/* Search */}
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-2.5 text-[var(--text-subtle)]" />
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] pl-7 pr-7 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:border-[var(--primary)] focus:outline-none focus:ring-0 w-52"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 text-[var(--text-subtle)] hover:text-[var(--text)]">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ALL_STATUSES.map((s) => {
            const count = statusCounts[s] ?? 0;
            if (s !== "all" && count === 0) return null;
            const active = filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                }`}
              >
                {s === "all" ? "All" : STATUS_LABEL[s]}
                <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${active ? "bg-[var(--primary-soft)]" : "bg-[var(--surface-2)]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-[var(--text-muted)]">
            No clients match your filters.
          </div>
        ) : (
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[var(--surface)]">
              <tr>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Client</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Status</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Latest content</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Last checked</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[var(--text-subtle)]">URLs</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Stale 90d</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[var(--text-subtle)]">GSC submitted</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[var(--text-subtle)]">GSC indexed</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[var(--text-subtle)]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const { client, snapshot, gsc } = row;
                const status = getStatus(snapshot);
                const state = syncState[client.id] ?? "idle";
                const syncing = state === "syncing";
                const website = normalizeWebsite(client.website);

                return (
                  <tr key={client.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)]">
                    {/* Client */}
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-[var(--text)]">{client.account_name}</div>
                      {website && (
                        <a
                          href={website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--text-subtle)] hover:text-[var(--primary)] transition-colors"
                        >
                          {client.website}
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                      {status === "error" && snapshot?.error_message && (
                        <p className="mt-0.5 max-w-[180px] truncate text-[var(--danger-fg)]" title={snapshot.error_message}>
                          {snapshot.error_message}
                        </p>
                      )}
                    </td>

                    {/* Latest content date */}
                    <td className="px-4 py-2.5 text-[var(--text)]">
                      {snapshot?.latest_lastmod ? (
                        <span title={new Date(snapshot.latest_lastmod).toISOString()}>
                          {absoluteDate(snapshot.latest_lastmod)}
                          <span className="ml-1.5 text-[var(--text-subtle)]">
                            ({relativeDate(snapshot.latest_lastmod)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-subtle)]">—</span>
                      )}
                    </td>

                    {/* Last checked */}
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">
                      {snapshot?.updated_at ? (
                        <span title={new Date(snapshot.updated_at).toISOString()}>
                          {relativeDate(snapshot.updated_at)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-subtle)]">Never</span>
                      )}
                    </td>

                    {/* URL count */}
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">
                      {snapshot ? (
                        <>
                          {snapshot.url_count.toLocaleString()}
                          {snapshot.with_lastmod_count < snapshot.url_count && (
                            <span className="ml-1 text-[var(--warning-fg)]">
                              ({snapshot.url_count - snapshot.with_lastmod_count} no date)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[var(--text-subtle)]">—</span>
                      )}
                    </td>

                    {/* Stale 90d */}
                    <td className="px-4 py-2.5">
                      {snapshot ? (
                        snapshot.stale_90_count > 0 ? (
                          <span className="font-medium text-[var(--danger-fg)]">
                            {snapshot.stale_90_count.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[var(--success-fg)]">0</span>
                        )
                      ) : (
                        <span className="text-[var(--text-subtle)]">—</span>
                      )}
                    </td>

                    {/* GSC submitted */}
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">
                      {gsc ? (
                        <span title={gsc.last_submitted ?? undefined}>
                          {relativeDate(gsc.last_submitted)}
                          {gsc.urls_submitted > 0 && (
                            <span className="ml-1 text-[var(--text-subtle)]">
                              ({gsc.urls_submitted.toLocaleString()} URLs)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[var(--text-subtle)]">—</span>
                      )}
                    </td>

                    {/* GSC indexed */}
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">
                      {gsc ? (
                        <span>
                          {gsc.urls_indexed.toLocaleString()}
                          {gsc.errors > 0 && (
                            <span className="ml-1 text-[var(--danger-fg)]">
                              ({gsc.errors} err)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[var(--text-subtle)]">—</span>
                      )}
                    </td>

                    {/* Sync button */}
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={syncing}
                        onClick={() => void syncClient(client.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-transparent px-2.5 py-1 text-[11px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
                      >
                        <RefreshCw size={11} className={syncing ? "animate-spin" : ""} />
                        {syncing ? "Checking…" : "Check"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-2 text-[11px] text-[var(--text-subtle)]">
        Showing {filtered.length} of {enrichedRows.length} clients · Sitemap data comes from parsing{" "}
        <code className="font-mono">/sitemap.xml</code> on each client website · GSC columns from Search Console sync
      </div>
    </div>
  );
}
