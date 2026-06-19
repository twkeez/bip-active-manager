"use client";
import { useState } from "react";
import Link from "next/link";
import { Clock, Loader2, RefreshCw } from "lucide-react";
import type { HarvestTimeActivityReport } from "@/lib/harvest/types";
function formatHours(value: number) {
  if (value <= 0) return "0h";
  return value.toFixed(1) + "h";
}
export default function HarvestTimePanel({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<HarvestTimeActivityReport | null>(null);
  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/harvest/time-activity");
      const payload = (await response.json()) as {
        error?: string;
        report?: HarvestTimeActivityReport;
      };
      if (!response.ok) {
        throw new Error(
          payload.error ?? "Failed to load Harvest time activity.",
        );
      }
      setReport(payload.report ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load Harvest time activity.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className={`rounded-xl border border-bip-border bg-bip-card/50 p-5 ${embedded ? "" : "mb-8"}`}
    >
      
      <div className="flex flex-wrap items-start justify-between gap-3">
        
        <div>
          
          <div className="flex items-center gap-2">
            
            <Clock className="text-bip-accent" size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-bip-text">
              
              Harvest time check
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-bip-muted">
            
            Pull strategist hours and flag marketing clients with no Harvest
            time for the previous or current calendar month. Requires admin
            Harvest token in{""}
            <code className="rounded bg-bip-card px-1 py-0.5 text-[10px]">
              .env.local
            </code>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReport()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-bip-accent px-3 py-2 text-xs font-medium text-bip-text transition hover:brightness-110 disabled:opacity-60"
        >
          
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? "Pulling Harvest…" : "Check Harvest time"}
        </button>
      </div>
      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          
          {error}
        </p>
      ) : null}
      {report ? (
        <div className="mt-5 space-y-6">
          
          <p className="text-[11px] text-bip-muted">
            
            Pulled {new Date(report.fetchedAt).toLocaleString()} · Previous
            month:{""} {report.previousMonth.label} ({report.previousMonth.from}
            to {report.previousMonth.to}) · Current month:
            {report.currentMonth.label} ({report.currentMonth.from} to{""}
            {report.currentMonth.to})
          </p>
          <div>
            
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
              
              Marketing strategists
            </h3>
            <div className="overflow-x-auto rounded-lg border border-bip-border">
              
              <table className="min-w-full text-left text-xs"><thead className="bg-bip-card/60 text-bip-muted"><tr><th className="px-3 py-2 font-medium">Strategist</th><th className="px-3 py-2 font-medium">Harvest match</th><th className="px-3 py-2 font-medium">
                      {report.previousMonth.label}
                    </th><th className="px-3 py-2 font-medium">
                      {report.currentMonth.label}
                    </th></tr></thead><tbody>{report.strategists.map((row) => (
                    <tr key={row.name} className="border-t border-bip-border"><td className="px-3 py-2 text-bip-text">
                        {row.name}
                      </td><td className="px-3 py-2 text-bip-muted">
                        
                        {row.matched
                          ? row.harvestUserName
                          : "No Harvest user matched"}
                      </td><td className="px-3 py-2">
                        
                        <span
                          className={
                            row.previousMonthHours > 0
                              ? "text-emerald-300"
                              : "text-amber-300"
                          }
                        >
                          
                          {formatHours(row.previousMonthHours)}
                        </span>
                      </td><td className="px-3 py-2">
                        
                        <span
                          className={
                            row.currentMonthHours > 0
                              ? "text-emerald-300"
                              : "text-amber-300"
                          }
                        >
                          
                          {formatHours(row.currentMonthHours)}
                        </span>
                      </td></tr>
                  ))}
                </tbody></table>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            
            <ClientGapList
              title={"Clients with no hours —" + report.previousMonth.label}
              count={report.clientsMissingPreviousMonth.length}
              rows={report.clientsMissingPreviousMonth}
            />
            <ClientGapList
              title={"Clients with no hours —" + report.currentMonth.label}
              count={report.clientsMissingCurrentMonth.length}
              rows={report.clientsMissingCurrentMonth}
            />
          </div>
          {report.clientsWithoutHarvestProject.length > 0 ? (
            <div>
              
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
                
                Marketing clients missing Harvest project ID (
                {report.clientsWithoutHarvestProject.length})
              </h3>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-bip-border px-3 py-2 text-xs text-bip-muted">
                
                {report.clientsWithoutHarvestProject.map((client) => (
                  <li key={client.clientId}>
                    
                    <Link
                      href={"/dashboard/clients/" + String(client.clientId)}
                      className="text-bip-accent hover:text-indigo-200"
                    >
                      
                      {client.accountName}
                    </Link>
                    {client.marketingStrategist
                      ? " ·" + client.marketingStrategist
                      : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
function ClientGapList({
  title,
  count,
  rows,
}: {
  title: string;
  count: number;
  rows: HarvestTimeActivityReport["clientsMissingCurrentMonth"];
}) {
  return (
    <div>
      
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
        
        {title} ({count})
      </h3>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          
          All linked marketing clients have hours logged.
        </p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-bip-border px-3 py-2 text-xs">
          
          {rows.map((client) => (
            <li key={client.clientId} className="text-bip-text">
              
              <Link
                href={"/dashboard/clients/" + String(client.clientId)}
                className="font-medium text-bip-accent hover:text-indigo-200"
              >
                
                {client.accountName}
              </Link>
              {client.marketingStrategist ? (
                <span className="text-bip-muted">
                  
                  · {client.marketingStrategist}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
