"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCopy,
  Download,
  Loader2,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import { buildAuditMarkdownExport } from "@/lib/ads/audit-narrative";
import { formatCostMicros } from "@/lib/ads/quality-score";
import type { AdsAuditReport, AdsAuditSnapshot } from "@/lib/types/client";
type Props = { clientId: number; clientName: string };
function keywordRowKey(
  row: AdsAuditReport["top_keywords"][number],
  index: number,
) {
  return `${row.keyword}|${row.campaign_name}|${row.ad_group_name}|${row.match_type}|${index}`;
}
function searchTermKey(
  row: AdsAuditReport["search_terms"]["waste_terms"][number],
  index: number,
) {
  return `${row.search_term}|${row.campaign_name}|${row.ad_group_name}|${index}`;
}
function geoRowKey(
  row: AdsAuditReport["geography"]["top_locations"][number],
  index: number,
) {
  return `${row.location_id}|${row.location_type}|${index}`;
}
function formatPercent(value: number | null) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function KeywordTable({
  rows,
  showNotes = false,
}: {
  rows: AdsAuditReport["top_keywords"];
  showNotes?: boolean;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-bip-muted">No keyword rows for this section.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-bip-border">
      
      <table className="min-w-full text-left text-xs"><thead className="bg-bip-page text-bip-text"><tr><th className="px-3 py-2">Keyword</th><th className="px-3 py-2">Match</th><th className="px-3 py-2">Spend</th><th className="px-3 py-2">Conv.</th><th className="px-3 py-2">CPA</th><th className="px-3 py-2">CVR</th><th className="px-3 py-2">QS</th>
            {showNotes && <th className="px-3 py-2">Notes</th>}
          </tr></thead><tbody>{rows.map((row, index) => (
            <tr
              key={keywordRowKey(row, index)}
              className="border-t border-zinc-100"
            ><td className="px-3 py-2 font-medium">{row.keyword}</td><td className="px-3 py-2">{row.match_type}</td><td className="px-3 py-2">{formatCostMicros(row.cost_micros)}</td><td className="px-3 py-2">{row.conversions}</td><td className="px-3 py-2">
                
                {row.cpa_micros ? formatCostMicros(row.cpa_micros) : "—"}
              </td><td className="px-3 py-2">
                {formatPercent(row.conversion_rate)}
              </td><td className="px-3 py-2">{row.quality_score ?? "—"}</td>
              {showNotes && (
                <td className="px-3 py-2 text-bip-text">{row.notes ?? "—"}</td>
              )}
            </tr>
          ))}
        </tbody></table>
    </div>
  );
}
export default function AdsAuditReportView({ clientId, clientName }: Props) {
  const [audit, setAudit] = useState<AdsAuditSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ads/audit/${clientId}`);
      const payload = (await response.json()) as {
        error?: string;
        audit?: AdsAuditSnapshot | null;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Failed to load audit.");
      setAudit(payload.audit ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load audit.",
      );
      setAudit(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);
  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);
  async function runAudit() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/ads/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, includeNarrative: true }),
      });
      const payload = (await response.json()) as {
        error?: string;
        audit?: AdsAuditSnapshot;
      };
      if (!response.ok) throw new Error(payload.error ?? "Audit run failed.");
      setAudit(payload.audit ?? null);
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : "Audit run failed.",
      );
    } finally {
      setRunning(false);
    }
  }
  const report = audit?.report;
  async function copyMarkdown() {
    if (!report) return;
    const markdown = buildAuditMarkdownExport(
      report,
      audit?.narrative_markdown ?? null,
    );
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  function downloadMarkdown() {
    if (!report) return;
    const markdown = buildAuditMarkdownExport(
      report,
      audit?.narrative_markdown ?? null,
    );
    downloadText(
      `ads-audit-${clientName.replace(/\s+/g, "-").toLowerCase()}.md`,
      markdown,
    );
  }
  return (
    <div className="min-h-screen bg-bip-page text-bip-text">
      
      <div className="mx-auto max-w-6xl px-4 py-8">
        
        <div className="mb-6 flex items-center justify-between gap-3">
          
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-bip-text hover:text-bip-text"
          >
            
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            
            <button
              type="button"
              onClick={() => void runAudit()}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-bip-card px-4 py-2 text-sm font-medium text-bip-text disabled:opacity-60"
            >
              
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Run audit
            </button>
            {report && (
              <>
                
                <button
                  type="button"
                  onClick={() => void copyMarkdown()}
                  className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-3 py-2 text-sm"
                >
                  
                  <ClipboardCopy className="h-4 w-4" />
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={downloadMarkdown}
                  className="inline-flex items-center gap-2 rounded-lg border border-bip-border px-3 py-2 text-sm"
                >
                  
                  <Download className="h-4 w-4" /> Download
                </button>
              </>
            )}
          </div>
        </div>
        <div className="mb-6">
          
          <p className="text-xs uppercase tracking-wide text-bip-muted">
            Google Ads Audit
          </p>
          <h1 className="text-2xl font-semibold">{clientName}</h1>
          {audit && (
            <p className="mt-1 text-sm text-bip-text">
              
              {audit.start_date} to {audit.end_date} • {audit.run_status}
            </p>
          )}
        </div>
        {loading && (
          <p className="flex items-center gap-2 text-sm text-bip-text">
            
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit…
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            
            {error}
          </p>
        )}
        {!loading && !report && !error && (
          <div className="rounded-xl border border-bip-border bg-bip-card p-6 shadow-none">
            
            <div className="flex items-start gap-3">
              
              <Megaphone className="mt-0.5 h-5 w-5 text-bip-muted" />
              <div>
                
                <p className="font-medium">No audit yet</p>
                <p className="mt-1 text-sm text-bip-text">
                  
                  Run an audit to sync Google Ads data, build structured
                  findings, and generate a narrative report.
                </p>
              </div>
            </div>
          </div>
        )}
        {report && (
          <div className="space-y-6">
            
            {audit?.narrative_markdown && (
              <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
                
                <h2 className="text-lg font-semibold">Narrative audit</h2>
                <div className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap text-bip-text">
                  
                  {audit.narrative_markdown}
                </div>
              </section>
            )}
            <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
              
              <h2 className="text-lg font-semibold">Account snapshot</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                
                <Metric
                  label="Spend"
                  value={formatCostMicros(
                    report.executive_snapshot.spend_micros,
                  )}
                />
                <Metric
                  label="Clicks"
                  value={String(report.executive_snapshot.clicks)}
                />
                <Metric
                  label="CTR"
                  value={formatPercent(report.executive_snapshot.ctr)}
                />
                <Metric
                  label="Conversions"
                  value={String(report.executive_snapshot.conversions)}
                />
                <Metric
                  label="CVR"
                  value={formatPercent(
                    report.executive_snapshot.conversion_rate,
                  )}
                />
                <Metric
                  label="Avg CPC"
                  value={
                    report.executive_snapshot.average_cpc_micros
                      ? formatCostMicros(
                          report.executive_snapshot.average_cpc_micros,
                        )
                      : "—"
                  }
                />
                <Metric
                  label="CPA"
                  value={
                    report.executive_snapshot.cost_per_conversion_micros
                      ? formatCostMicros(
                          report.executive_snapshot.cost_per_conversion_micros,
                        )
                      : "—"
                  }
                />
                <Metric
                  label="Broad spend share"
                  value={`${Math.round(report.match_type_mix.broad_spend_share * 100)}%`}
                />
              </div>
            </section>
            {report.priorities.length > 0 && (
              <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
                
                <h2 className="text-lg font-semibold">
                  Priority recommendations
                </h2>
                <ol className="mt-3 space-y-2 text-sm">
                  
                  {report.priorities.map((item) => (
                    <li key={item.rank}>
                      
                      <span className="font-medium">{item.title}</span>
                      <span className="text-bip-text">
                        
                        — {item.rationale}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
              
              <h2 className="text-lg font-semibold">Match type mix</h2>
              {report.match_type_mix.flag_broad_dominant && (
                <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                  
                  Broad Match dominates spend (
                  {Math.round(report.match_type_mix.broad_spend_share * 100)}%).
                  Review match types and negatives.
                </p>
              )}
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                
                <p>
                  Broad:
                  {Math.round(report.match_type_mix.broad_spend_share * 100)}%
                  spend
                </p>
                <p>
                  Phrase:
                  {Math.round(report.match_type_mix.phrase_spend_share * 100)}%
                  spend
                </p>
                <p>
                  Exact:
                  {Math.round(report.match_type_mix.exact_spend_share * 100)}%
                  spend
                </p>
              </div>
            </section>
            <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
              
              <h2 className="text-lg font-semibold">
                Top performing keywords
              </h2>
              <div className="mt-3">
                
                <KeywordTable rows={report.top_keywords} />
              </div>
            </section>
            <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
              
              <h2 className="text-lg font-semibold">
                Keywords likely wasting budget
              </h2>
              <div className="mt-3">
                
                <KeywordTable rows={report.waste_keywords} showNotes />
              </div>
            </section>
            <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
              
              <h2 className="text-lg font-semibold">
                Quality Score problems
              </h2>
              <p className="mt-2 text-sm text-bip-text">
                
                {report.quality_score.summary.flagged_keywords} flagged •{""}
                {report.quality_score.summary.quality_score_low} at QS ≤ 5 •{""}
                {report.quality_score.summary.landing_page_below_average} LP
                below average
              </p>
              <div className="mt-3">
                
                <KeywordTable
                  rows={report.quality_score.low_quality_keywords}
                  showNotes
                />
              </div>
            </section>
            <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
              
              <h2 className="text-lg font-semibold">Search terms</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                
                <div>
                  
                  <h3 className="text-sm font-semibold text-bip-text">
                    Waste terms
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs">
                    
                    {report.search_terms.waste_terms
                      .slice(0, 10)
                      .map((row, index) => (
                        <li key={searchTermKey(row, index)}>
                          
                          {row.search_term} —
                          {formatCostMicros(row.cost_micros)}
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  
                  <h3 className="text-sm font-semibold text-bip-text">
                    Negative candidates
                  </h3>
                  <p className="mt-2 text-xs text-bip-text">
                    
                    {report.search_terms.negative_candidates.join(",") ||
                      "None identified"}
                  </p>
                </div>
                <div>
                  
                  <h3 className="text-sm font-semibold text-bip-text">
                    Query drift
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs">
                    
                    {report.search_terms.drift_terms
                      .slice(0, 10)
                      .map((row, index) => (
                        <li key={searchTermKey(row, index)}>
                          {row.search_term}
                        </li>
                      ))}
                    {!report.search_terms.drift_terms.length && (
                      <li className="text-bip-muted">None identified</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
            {(report.geography.top_locations.length > 0 ||
              report.geography.waste_locations.length > 0) && (
              <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
                
                <h2 className="text-lg font-semibold">
                  Geographic performance
                </h2>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  
                  <div>
                    
                    <h3 className="text-sm font-semibold text-bip-text">
                      Top spend locations
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs">
                      
                      {report.geography.top_locations
                        .slice(0, 10)
                        .map((row, index) => (
                          <li key={geoRowKey(row, index)}>
                            
                            {row.location_id} ({row.location_type}) —{""}
                            {formatCostMicros(row.cost_micros)},
                            {row.conversions} conv.
                          </li>
                        ))}
                    </ul>
                  </div>
                  <div>
                    
                    <h3 className="text-sm font-semibold text-bip-text">
                      Geo waste
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs">
                      
                      {report.geography.waste_locations
                        .slice(0, 10)
                        .map((row, index) => (
                          <li key={geoRowKey(row, index)}>
                            
                            {row.location_id} —
                            {formatCostMicros(row.cost_micros)}, 0 conv.
                          </li>
                        ))}
                      {!report.geography.waste_locations.length && (
                        <li className="text-bip-muted">None identified</li>
                      )}
                    </ul>
                  </div>
                </div>
              </section>
            )}
            {(report.account_metadata.campaigns.length > 0 ||
              report.account_metadata.conversion_actions.length > 0) && (
              <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
                
                <h2 className="text-lg font-semibold">Account metadata</h2>
                {report.account_metadata.campaigns.length > 0 && (
                  <div className="mt-3">
                    
                    <h3 className="text-sm font-semibold text-bip-text">
                      Campaign bidding
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs">
                      
                      {report.account_metadata.campaigns
                        .slice(0, 10)
                        .map((row) => (
                          <li key={row.campaign_id}>
                            
                            {row.campaign_name}: {row.bidding_strategy_type} (
                            {row.advertising_channel_type})
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                {report.account_metadata.conversion_actions.length > 0 && (
                  <div className="mt-4">
                    
                    <h3 className="text-sm font-semibold text-bip-text">
                      Conversion actions
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs">
                      
                      {report.account_metadata.conversion_actions.map((row) => (
                        <li key={row.name}>
                          
                          {row.name} — {row.type}, {row.counting_type}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
            {report.devices.rows.length > 0 && (
              <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
                
                <h2 className="text-lg font-semibold">Device breakdown</h2>
                <ul className="mt-3 space-y-1 text-sm">
                  
                  {report.devices.rows.map((row) => (
                    <li key={row.device}>
                      
                      {row.device}: {formatCostMicros(row.cost_micros)} spend,
                      {row.conversions}
                      {""} conv.
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {report.schedule.best_windows.length > 0 && (
              <section className="rounded-xl border border-bip-border bg-bip-card p-5 shadow-none">
                
                <h2 className="text-lg font-semibold">Schedule windows</h2>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  
                  <div>
                    
                    <h3 className="text-sm font-semibold">
                      Best CPA windows
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs">
                      
                      {report.schedule.best_windows.map((row) => (
                        <li key={`${row.day_of_week}-${row.hour}`}>
                          
                          {row.day_of_week} {row.hour}:00 — CPA{""}
                          {row.cpa_micros
                            ? formatCostMicros(row.cpa_micros)
                            : "—"}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    
                    <h3 className="text-sm font-semibold">
                      Worst CPA windows
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs">
                      
                      {report.schedule.worst_windows.map((row) => (
                        <li key={`${row.day_of_week}-${row.hour}`}>
                          
                          {row.day_of_week} {row.hour}:00 — CPA{""}
                          {row.cpa_micros
                            ? formatCostMicros(row.cpa_micros)
                            : "—"}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}
            {report.missing_data.length > 0 && (
              <section className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5">
                
                <h2 className="text-lg font-semibold">Missing data</h2>
                <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
                  
                  {report.missing_data.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bip-border bg-bip-page px-3 py-2">
      
      <p className="text-xs uppercase tracking-wide text-bip-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
