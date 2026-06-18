"use client";

import { useState } from "react";
import { RefreshCw, Loader, ChevronDown, ChevronUp } from "lucide-react";

type SyncClient = { id: number; account_name: string; sc_url: string | null; ga4_property_id: string | null };

type ClientResult = { gsc: "skip" | "ok" | "error"; ga4: "skip" | "ok" | "error" };

export default function DataSyncAllButton() {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<Record<number, ClientResult>>({});
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAll() {
    setState("running");
    setError(null);
    setResults({});
    setExpanded(false);

    // Fetch clients that have at least one sync-able connection
    const res = await fetch("/api/clients/syncable").catch(() => null);
    if (!res?.ok) {
      setError("Could not load client list");
      setState("idle");
      return;
    }
    const { clients } = await res.json() as { clients: SyncClient[] };
    setProgress({ done: 0, total: clients.length });

    for (const client of clients) {
      const result: ClientResult = { gsc: "skip", ga4: "skip" };

      if ((client.sc_url ?? "").trim()) {
        try {
          const r = await fetch("/api/seo/search-console/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: client.id }),
          });
          result.gsc = r.ok ? "ok" : "error";
        } catch { result.gsc = "error"; }
      }

      if ((client.ga4_property_id ?? "").trim()) {
        try {
          const r = await fetch("/api/ga4/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: client.id }),
          });
          result.ga4 = r.ok ? "ok" : "error";
        } catch { result.ga4 = "error"; }
      }

      setResults((prev) => ({ ...prev, [client.id]: result }));
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setState("done");
  }

  const errorCount = Object.values(results).filter((r) => r.gsc === "error" || r.ga4 === "error").length;
  const okCount = Object.values(results).filter((r) => r.gsc === "ok" || r.ga4 === "ok").length;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {state === "running" && (
          <span className="text-xs text-[var(--text-subtle)]">
            <Loader size={11} className="inline animate-spin mr-1" />
            {progress.done}/{progress.total} clients…
          </span>
        )}
        {state === "done" && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors"
          >
            {okCount > 0 && <span className="text-green-400">{okCount} synced</span>}
            {errorCount > 0 && <span className="ml-1 text-red-400">{errorCount} errors</span>}
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
        <button
          onClick={() => void runAll()}
          disabled={state === "running"}
          className="bip-btn-secondary py-1.5 px-3 text-xs disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          {state === "running" ? (
            <><Loader size={11} className="animate-spin" /> Syncing…</>
          ) : (
            <><RefreshCw size={11} /> Sync All Data</>
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Collapsible results summary */}
      {expanded && state === "done" && (
        <div className="mt-1 max-h-48 w-64 overflow-y-auto rounded-lg border border-[var(--bip-border)] bg-[var(--bip-card)] p-3 text-xs shadow-lg">
          {Object.entries(results).map(([id, r]) => (
            <div key={id} className="flex items-center justify-between py-0.5">
              <span className="text-[var(--text-muted)] truncate max-w-[140px]">Client {id}</span>
              <span className="flex gap-2 text-[10px]">
                {r.gsc !== "skip" && <span className={r.gsc === "ok" ? "text-green-400" : "text-red-400"}>GSC {r.gsc}</span>}
                {r.ga4 !== "skip" && <span className={r.ga4 === "ok" ? "text-green-400" : "text-red-400"}>GA4 {r.ga4}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
