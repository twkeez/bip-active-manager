"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle, XCircle, Loader, CircleDot, ScanSearch, RefreshCw } from "lucide-react";
import Link from "next/link";

type ClientRow = {
  id: number;
  account_name: string;
  website: string;
  ga4_id: string | null;
  google_place_id: string | null;
};

type DiscoverResult = {
  ga4_id: string | null;
  google_place_id: string | null;
  sources: Record<string, string>;
};

type ClientStatus =
  | { state: "pending" }
  | { state: "scanning" }
  | { state: "done"; result: DiscoverResult; saved: boolean }
  | { state: "error"; message: string };

export default function BulkDiscoverView() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [statuses, setStatuses] = useState<Record<number, ClientStatus>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    void loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    setDone(false);
    setStatuses({});
    try {
      const res = await fetch("/api/clients/discover-missing");
      const json = await res.json() as { clients?: ClientRow[] };
      const list = json.clients ?? [];
      setClients(list);
      const initial: Record<number, ClientStatus> = {};
      for (const c of list) initial[c.id] = { state: "pending" };
      setStatuses(initial);
    } finally {
      setLoading(false);
    }
  }

  function setStatus(id: number, status: ClientStatus) {
    setStatuses((s) => ({ ...s, [id]: status }));
  }

  async function runAll() {
    abortRef.current = false;
    setRunning(true);
    setDone(false);

    for (const client of clients) {
      if (abortRef.current) break;
      setStatus(client.id, { state: "scanning" });

      try {
        const res = await fetch(`/api/clients/${client.id}/discover`);
        const result = await res.json() as DiscoverResult & { error?: string };
        if (!res.ok) throw new Error(result.error ?? "Discovery failed");

        // Save any newly found IDs
        const patch: Record<string, string> = {};
        if (result.ga4_id && !(client.ga4_id ?? "").trim()) patch.ga4_id = result.ga4_id;
        if (result.google_place_id && !(client.google_place_id ?? "").trim()) patch.google_place_id = result.google_place_id;

        let saved = false;
        if (Object.keys(patch).length > 0) {
          const saveRes = await fetch(`/api/clients/${client.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          saved = saveRes.ok;
        }

        setStatus(client.id, { state: "done", result, saved });
      } catch (e) {
        setStatus(client.id, { state: "error", message: e instanceof Error ? e.message : "Failed" });
      }
    }

    setRunning(false);
    setDone(true);
  }

  function stop() {
    abortRef.current = true;
  }

  const counts = {
    pending: Object.values(statuses).filter((s) => s.state === "pending").length,
    scanning: Object.values(statuses).filter((s) => s.state === "scanning").length,
    found: Object.values(statuses).filter((s) => s.state === "done" && ((s as {state:"done";result:DiscoverResult;saved:boolean}).result.ga4_id || (s as {state:"done";result:DiscoverResult;saved:boolean}).result.google_place_id)).length,
    empty: Object.values(statuses).filter((s) => s.state === "done" && !(s as {state:"done";result:DiscoverResult;saved:boolean}).result.ga4_id && !(s as {state:"done";result:DiscoverResult;saved:boolean}).result.google_place_id).length,
    error: Object.values(statuses).filter((s) => s.state === "error").length,
  };

  const processed = clients.length - counts.pending - counts.scanning;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Bulk Auto-Discover</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Scans each client website to find missing GA4 IDs and Google Place IDs, then saves them automatically.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!running ? (
          <button
            onClick={() => void runAll()}
            disabled={loading || clients.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--bip-accent)] px-4 py-2 text-sm font-medium text-bip-text hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <ScanSearch size={15} />
            {done ? "Run again" : `Scan ${clients.length} clients`}
          </button>
        ) : (
          <button
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Stop
          </button>
        )}
        <button
          onClick={() => void loadClients()}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={13} /> Reload list
        </button>
      </div>

      {/* Progress bar */}
      {(running || done) && clients.length > 0 && (
        <div className="space-y-2">
          <div className="h-1.5 w-full rounded-full bg-bip-fill overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--bip-accent)] transition-all duration-300"
              style={{ width: `${(processed / clients.length) * 100}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-[var(--text-muted)]">
            <span>{processed}/{clients.length} scanned</span>
            {counts.found > 0 && <span className="text-green-400">{counts.found} found</span>}
            {counts.empty > 0 && <span className="text-bip-subtle">{counts.empty} nothing found</span>}
            {counts.error > 0 && <span className="text-red-400">{counts.error} errors</span>}
          </div>
        </div>
      )}

      {/* Client list */}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading clients…</p>
      ) : clients.length === 0 ? (
        <div className="bip-card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">All clients with a website already have both IDs filled in.</p>
        </div>
      ) : (
        <div className="bip-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bip-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-subtle)] uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-subtle)] uppercase tracking-wider">GA4 ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-subtle)] uppercase tracking-wider">Place ID</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-subtle)] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {clients.map((client) => {
                const status = statuses[client.id] ?? { state: "pending" };
                const doneStatus = status.state === "done" ? status : null;
                const displayGa4 = doneStatus?.result.ga4_id ?? client.ga4_id ?? null;
                const displayPlace = doneStatus?.result.google_place_id ?? client.google_place_id ?? null;

                return (
                  <tr key={client.id} className={status.state === "scanning" ? "bg-bip-hover" : ""}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/clients/${client.id}?tab=connections`}
                        className="text-[var(--text)] hover:text-[var(--bip-accent)] transition-colors"
                      >
                        {client.account_name}
                      </Link>
                      <div className="text-xs text-[var(--text-subtle)] truncate max-w-[180px]">{client.website}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {displayGa4 ? (
                        <span className={doneStatus?.result.ga4_id && !client.ga4_id ? "text-green-400" : "text-[var(--text-muted)]"}>
                          {displayGa4}
                        </span>
                      ) : (
                        <span className="text-bip-subtle">missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {displayPlace ? (
                        <span className={doneStatus?.result.google_place_id && !client.google_place_id ? "text-green-400" : "text-[var(--text-muted)]"}>
                          {displayPlace.slice(0, 20)}…
                        </span>
                      ) : (
                        <span className="text-bip-subtle">missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ClientStatus }) {
  if (status.state === "pending") {
    return <span className="text-xs text-bip-subtle">—</span>;
  }
  if (status.state === "scanning") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--bip-accent)]">
        <Loader size={12} className="animate-spin" /> Scanning…
      </span>
    );
  }
  if (status.state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-400" title={status.message}>
        <XCircle size={12} /> Error
      </span>
    );
  }
  const hasResult = status.result.ga4_id || status.result.google_place_id;
  if (hasResult) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
        <CheckCircle size={12} /> {status.saved ? "Saved" : "Found"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-bip-subtle">
      <CircleDot size={12} /> Nothing found
    </span>
  );
}
