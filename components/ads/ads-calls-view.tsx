"use client";

import { useMemo, useState } from "react";
import { Phone, PhoneMissed } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { ToolPage } from "@/components/ui/tool-page";
import type { AdsCallsData } from "@/lib/ads/load-ads-calls";

function fmtDuration(sec: number): string {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdsCallsView({ data }: { data: AdsCallsData }) {
  const { calls, summary, lastSyncAt, loadError } = data;
  const [client, setClient] = useState("all");
  const [status, setStatus] = useState<"all" | "received" | "missed">("all");

  const clientOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const c of calls) names.set(c.accountName, c.accountName);
    return [...names.keys()].sort((a, b) => a.localeCompare(b));
  }, [calls]);

  const filtered = useMemo(
    () =>
      calls.filter((c) => {
        if (client !== "all" && c.accountName !== client) return false;
        if (status === "received" && !c.status.toUpperCase().includes("RECEIVED")) return false;
        if (status === "missed" && !c.status.toUpperCase().includes("MISSED")) return false;
        return true;
      }),
    [calls, client, status],
  );

  return (
    <ToolPage
      title="Ad Calls"
      icon={Phone}
      maxWidth="6xl"
      description={`Individual phone calls driven by Google Ads call assets, from each client's latest 30-day sync. Google exposes the caller area code, duration, and outcome — not the full number — and retains this detail for a limited window. ${lastSyncAt ? `Latest sync: ${fmtTime(lastSyncAt)}.` : ""}`}
    >
      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <>
          <StatTiles>
            <StatTile label="Calls (30d)" value={summary.total} />
            <StatTile label="Received" value={summary.received} />
            <StatTile label="Missed" value={summary.missed} />
            <StatTile label="Avg length" value={fmtDuration(summary.avgDurationSeconds)} />
          </StatTiles>

          {calls.length === 0 ? (
            <EmptyState
              title="No call detail on record yet."
              hint="Calls appear after an ads sync for accounts that run call assets with Google forwarding numbers."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className="rounded-md bip-input text-sm shadow-none"
                >
                  <option value="all">All clients ({summary.clientsWithCalls})</option>
                  {clientOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <div className="flex overflow-hidden rounded-md border border-bip-border">
                  {(["all", "received", "missed"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`px-3 py-1.5 text-xs ${status === s ? "bg-bip-fill text-bip-text" : "text-bip-muted hover:bg-bip-fill/50"}`}
                    >
                      {s === "all" ? "All" : titleCase(s)}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-bip-muted">{filtered.length} shown</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-bip-border bg-bip-card">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-bip-border text-left text-[11px] uppercase tracking-wide text-bip-muted">
                      <th className="px-4 py-2 font-medium">When</th>
                      <th className="px-4 py-2 font-medium">Client</th>
                      <th className="px-4 py-2 font-medium">Campaign</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium">Length</th>
                      <th className="px-4 py-2 font-medium">Area code</th>
                      <th className="px-4 py-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => {
                      const missed = c.status.toUpperCase().includes("MISSED");
                      return (
                        <tr key={i} className="border-b border-bip-border last:border-b-0">
                          <td className="whitespace-nowrap px-4 py-2 text-bip-muted">{fmtTime(c.startTime)}</td>
                          <td className="px-4 py-2 text-bip-text">{c.accountName}</td>
                          <td className="max-w-[200px] truncate px-4 py-2 text-bip-muted">{c.campaignName}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center gap-1 text-xs ${missed ? "text-red-300" : "text-emerald-400"}`}
                            >
                              {missed ? <PhoneMissed className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                              {titleCase(c.status)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-bip-text">{fmtDuration(c.durationSeconds)}</td>
                          <td className="px-4 py-2 tabular-nums text-bip-muted">{c.callerAreaCode ?? "—"}</td>
                          <td className="px-4 py-2 text-bip-muted">{titleCase(c.displayLocation)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </ToolPage>
  );
}
