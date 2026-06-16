"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  LayoutGrid,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import AppHeaderActions from "@/components/layout/app-header-actions";
import PlaybookGuidancePanel, {
  PlaybookInlineTrigger,
} from "@/components/dashboard/playbook-guidance-panel";
import {
  runMockTrackingValidation,
  type ConversionIntegrityAnomaly,
  type ConversionIntegritySummary,
  type MockTrackingValidationResult,
} from "@/lib/ads/conversion-integrity";
import {
  CONVERSION_INTEGRITY_PLAYBOOK_SECTIONS,
  conversionIntegrityToPlaybook,
} from "@/lib/playbooks/content";
type Props = {
  anomalies: ConversionIntegrityAnomaly[];
  summary: ConversionIntegritySummary;
  lastAdsSyncAt: string | null;
  userEmail?: string;
  loadError?: string | null;
};
function formatSyncTime(value: string | null) {
  if (!value) return "No ads snapshots synced yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown sync time";
  return `Last ads sync ${parsed.toLocaleString()}`;
}
export default function ConversionIntegrityRadar({
  anomalies,
  summary,
  lastAdsSyncAt,
  userEmail,
  loadError,
}: Props) {
  const [mutedIds, setMutedIds] = useState<Set<string>>(() => new Set());
  const [auditedIds, setAuditedIds] = useState<Set<string>>(() => new Set());
  const [validationById, setValidationById] = useState<
    Record<string, MockTrackingValidationResult>
  >({});
  const [runningValidationId, setRunningValidationId] = useState<string | null>(
    null,
  );
  const visibleAnomalies = useMemo(
    () => anomalies.filter((row) => !mutedIds.has(row.id)),
    [anomalies, mutedIds],
  );
  async function handleRunValidation(anomaly: ConversionIntegrityAnomaly) {
    setRunningValidationId(anomaly.id);
    try {
      const response = await fetch("/api/ads/conversion-integrity/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: anomaly.clientId,
          campaignId: anomaly.campaignId,
          anomalyType: anomaly.anomalyType,
          severity: anomaly.severity,
          conversionRateLabel: anomaly.conversionRateLabel,
          clicks: anomaly.clicks,
        }),
      });
      const payload =
        (await response.json()) as MockTrackingValidationResult & {
          error?: string;
        };
      if (!response.ok) {
        throw new Error(payload.error ?? "Validation failed");
      }
      setValidationById((current) => ({ ...current, [anomaly.id]: payload }));
    } catch {
      setValidationById((current) => ({
        ...current,
        [anomaly.id]: runMockTrackingValidation({ anomaly }),
      }));
    } finally {
      setRunningValidationId(null);
    }
  }
  function handleFlagAudit(anomaly: ConversionIntegrityAnomaly) {
    setAuditedIds((current) => new Set(current).add(anomaly.id));
  }
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-bip-page font-sans text-white">
      
      <header className="border-b border-white/[0.08] px-6 py-5">
        
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          
          <div className="min-w-0">
            
            <div className="flex items-center gap-3">
              
              <Link
                href="/dashboard"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-bip-card/50 text-white/75 transition hover:bg-bip-card/60"
                title="Control panel"
              >
                
                <LayoutGrid className="h-4 w-4" aria-hidden />
              </Link>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                
                <ShieldAlert className="h-5 w-5" aria-hidden />
              </div>
              <div>
                
                <h1 className="text-lg font-semibold tracking-tight text-white">
                  
                  Conversion Integrity Radar
                </h1>
                <p className="mt-0.5 text-xs text-white/50">
                  
                  Cross-account tracking audit · {userEmail ?? "Signed in"}
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-white/50">
              
              Scanned {summary.campaignsScanned} campaigns across
              {summary.accountsScanned}
              {""} synced accounts. {formatSyncTime(lastAdsSyncAt)}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            
            <Link
              href="/global-ads-optimization"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-bip-card/60"
            >
              
              Global Ads Center
            </Link>
            <PlaybookGuidancePanel
              variant="drawer"
              sections={CONVERSION_INTEGRITY_PLAYBOOK_SECTIONS}
            />
            <AppHeaderActions />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-6 py-8">
        
        {loadError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            
            {loadError}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">
              
              Active anomalies
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {visibleAnomalies.length}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              
              Critical
            </p>
            <p className="mt-1 text-xl font-bold text-red-400">
              {summary.criticalCount}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              
              High warning
            </p>
            <p className="mt-1 text-xl font-bold text-amber-400">
              {summary.highCount}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              
              Accounts affected
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {summary.accountsAffected}
            </p>
          </div>
        </div>
        <section className="space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            
            <div>
              
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/50">
                
                <ShieldAlert size={16} className="text-rose-400" /> Conversion
                Integrity Radar
              </h2>
              <p className="mt-1 text-xs text-white/50">
                
                Cross-account auditing suite isolating broken tracking scripts
                and inflated conversion counts.
              </p>
            </div>
            <span className="rounded border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400">
              
              {visibleAnomalies.length} Active Anomal
              {visibleAnomalies.length === 1 ? "y" : "ies"}
            </span>
          </div>
          {visibleAnomalies.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08]/40 bg-bip-card/10 p-8 text-center text-xs text-white/50">
              
              <CheckCircle2 size={14} className="text-emerald-500/60" /> All
              running campaign profiles are verifying conversion patterns within
              expected benchmark parameters.
            </div>
          ) : (
            visibleAnomalies.map((item) => {
              const validation = validationById[item.id];
              const isRunning = runningValidationId === item.id;
              const isAudited = auditedIds.has(item.id);
              const severityClass =
                item.severity === "critical"
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-400";
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-bip-card/40 p-5 transition hover:border-white/[0.08] lg:flex-row lg:items-center lg:justify-between"
                >
                  
                  <div className="min-w-0 flex-1 space-y-1.5">
                    
                    <div className="flex flex-wrap items-center gap-2">
                      
                      <Link
                        href={`/dashboard/clients/${item.clientId}?tab=ads`}
                        className="text-sm font-semibold text-white/75 hover:text-bip-accent"
                      >
                        
                        {item.accountName}
                      </Link>
                      <span className="font-mono text-[10px] text-white/50">
                        {item.accountIdLabel}
                      </span>
                      {isAudited ? (
                        <span className="rounded border border-indigo-500/20 bg-bip-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-bip-accent">
                          
                          Flagged for audit
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-white/50">
                      
                      Campaign scope:{""}
                      <span className="font-mono text-white/75">
                        {item.campaignName}
                      </span>
                    </div>
                    <div className="mt-3 flex max-w-sm gap-6 border-t border-white/[0.08] pt-2">
                      
                      <div>
                        
                        <p className="text-[10px] uppercase text-white/50">
                          Clicks
                        </p>
                        <p className="text-sm font-bold text-white/75">
                          {item.clicks}
                        </p>
                      </div>
                      <div>
                        
                        <p className="text-[10px] uppercase text-white/50">
                          Conversions
                        </p>
                        <p className="text-sm font-bold text-rose-400">
                          {item.conversions}
                        </p>
                      </div>
                      <div>
                        
                        <p className="text-[10px] uppercase text-white/50">
                          Conversion rate
                        </p>
                        <p className="font-mono text-sm font-bold text-rose-400">
                          
                          {item.conversionRateLabel}
                        </p>
                      </div>
                    </div>
                    {validation ? (
                      <ul className="mt-3 space-y-1 rounded-lg border border-white/[0.08] bg-bip-card/40 p-3 text-xs text-white/50">
                        
                        {validation.findings.map((finding) => (
                          <li key={finding}>• {finding}</li>
                        ))}
                      </ul>
                    ) : null}
                    {conversionIntegrityToPlaybook(item.anomalyType) ? (
                      <PlaybookInlineTrigger
                        issueType={
                          conversionIntegrityToPlaybook(item.anomalyType)!
                        }
                      />
                    ) : null}
                  </div>
                  <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:flex-row lg:w-auto lg:flex-col lg:items-end">
                    
                    <div
                      className={`mb-1 flex items-center justify-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${severityClass}`}
                    >
                      
                      <RefreshCw
                        size={12}
                        className={isRunning ? "animate-spin" : ""}
                      />
                      {item.anomalyLabel}
                    </div>
                    <div className="flex w-full gap-2">
                      
                      <button
                        type="button"
                        onClick={() => void handleRunValidation(item)}
                        disabled={isRunning}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-bip-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-bip-accent disabled:opacity-60"
                      >
                        
                        {isRunning ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <>
                            
                            Inspect landing code <ArrowRight size={12} />
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlagAudit(item)}
                        className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-bip-card/70"
                        title="Flag for manual tag audit"
                      >
                        
                        <ClipboardList size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setMutedIds((current) =>
                            new Set(current).add(item.id),
                          )
                        }
                        className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2 text-xs font-medium text-white/50 transition hover:bg-bip-card/70"
                      >
                        
                        Mute
                      </button>
                    </div>
                    <Link
                      href={`/dashboard/clients/${item.clientId}?tab=ads`}
                      className="inline-flex items-center justify-end gap-1 text-[10px] text-white/50 transition hover:text-white/75"
                    >
                      
                      Open ads workspace <ExternalLink size={10} />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
          {visibleAnomalies.length > 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08]/40 bg-bip-card/10 p-4 text-center text-xs text-white/50">
              
              <CheckCircle2 size={14} className="text-emerald-500/60" />
              Remaining synced campaigns are within expected conversion
              benchmarks (or muted).
            </div>
          ) : null}
        </section>
        <PlaybookGuidancePanel
          variant="accordion"
          sections={CONVERSION_INTEGRITY_PLAYBOOK_SECTIONS}
        />
      </main>
    </div>
  );
}
