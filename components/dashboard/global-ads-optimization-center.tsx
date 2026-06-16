"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  Coins,
  ExternalLink,
  Filter,
  LayoutGrid,
  Loader2,
  Megaphone,
  RefreshCw,
  Target,
} from "lucide-react";
import AppHeaderActions from "@/components/layout/app-header-actions";
import PlaybookGuidancePanel, {
  PlaybookInlineTrigger,
} from "@/components/dashboard/playbook-guidance-panel";
import { buildGoogleAdsOptimizeTarget } from "@/lib/ads/google-ads-ui-links";
import {
  GLOBAL_ADS_PLAYBOOK_SECTIONS,
  globalAdsIssueToPlaybook,
} from "@/lib/playbooks/content";
import type {
  GlobalAdsIssue,
  GlobalAdsIssueType,
  GlobalAdsOptimizationSummary,
} from "@/lib/ads/global-optimization";
import type { GlobalAdsCoverageStats } from "@/lib/dashboard/load-global-ads-optimization-data";
type SortKey = "severity" | "account" | "category";
type Props = {
  issues: GlobalAdsIssue[];
  summary: GlobalAdsOptimizationSummary;
  coverage: GlobalAdsCoverageStats;
  lastAdsSyncAt: string | null;
  userEmail?: string;
  loadError?: string | null;
};
const FILTER_OPTIONS: Array<{ value: GlobalAdsIssueType; label: string }> = [
  { value: "ad_relevance", label: "Ad Relevance Deficits" },
  { value: "expected_ctr", label: "Expected CTR Deficits" },
  { value: "low_quality_score", label: "Low Quality Scores" },
  { value: "budget_capped", label: "Budget Limitations" },
  { value: "rank_lost", label: "Ad Rank Loss" },
];
const ALL_ISSUE_TYPES = FILTER_OPTIONS.map((option) => option.value);
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2 } as const;
function formatSyncTime(value: string | null) {
  if (!value) return "No ads snapshots synced yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown sync time";
  return `Last ads sync ${parsed.toLocaleString()}`;
}
function severityBadgeClass(severity: GlobalAdsIssue["severity"]) {
  if (severity === "critical") {
    return "bg-red-500/10 text-red-400 border-red-500/20";
  }
  if (severity === "high") {
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
  return "bg-slate-700/40 text-white/75 border-slate-600/40";
}
type SyncAllMessage = { type: "success" | "error"; text: string };
export default function GlobalAdsOptimizationCenter({
  issues,
  summary,
  coverage,
  lastAdsSyncAt,
  userEmail,
  loadError,
}: Props) {
  const router = useRouter();
  const [selectedFilters, setSelectedFilters] = useState<
    Set<GlobalAdsIssueType>
  >(() => new Set(ALL_ISSUE_TYPES));
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllMessage, setSyncAllMessage] = useState<SyncAllMessage | null>(
    null,
  );
  function toggleFilter(type: GlobalAdsIssueType) {
    setSelectedFilters((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }
  function selectAllFilters() {
    setSelectedFilters(new Set(ALL_ISSUE_TYPES));
  }
  function clearAllFilters() {
    setSelectedFilters(new Set());
  }
  const filteredIssues = useMemo(() => {
    const filtered = issues.filter((issue) =>
      selectedFilters.has(issue.issueType),
    );
    return [...filtered].sort((left, right) => {
      if (sortKey === "account") {
        const byAccount = left.accountName.localeCompare(right.accountName);
        if (byAccount !== 0) return byAccount;
        return right.sortWeight - left.sortWeight;
      }
      if (sortKey === "category") {
        const byCategory = left.issueLabel.localeCompare(right.issueLabel);
        if (byCategory !== 0) return byCategory;
        return right.sortWeight - left.sortWeight;
      }
      const severityDelta =
        SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
      if (severityDelta !== 0) return severityDelta;
      return right.sortWeight - left.sortWeight;
    });
  }, [issues, selectedFilters, sortKey]);
  function cycleSortKey() {
    setSortKey((current) => {
      if (current === "severity") return "account";
      if (current === "account") return "category";
      return "severity";
    });
  }
  async function handleSyncAll() {
    setSyncingAll(true);
    setSyncAllMessage(null);
    try {
      const response = await fetch("/api/ads/sync-all", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        synced?: number;
        failed?: number;
        skipped?: number;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Sync all failed");
      }
      const synced = payload.synced ?? 0;
      const failed = payload.failed ?? 0;
      const skipped = payload.skipped ?? 0;
      const skippedSuffix =
        skipped > 0 ? `, ${skipped} skipped (no valid 10-digit Ads ID)` : "";
      setSyncAllMessage({
        type: failed > 0 ? "error" : "success",
        text: `Ads sync complete: ${synced} synced, ${failed} failed${skippedSuffix}.`,
      });
      router.refresh();
    } catch (error) {
      setSyncAllMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Sync all failed",
      });
    } finally {
      setSyncingAll(false);
    }
  }
  const syncAllButton = (
    <button
      type="button"
      onClick={() => void handleSyncAll()}
      disabled={syncingAll || coverage.syncableAccountCount === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-bip-accent/10 px-3 py-1.5 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/20 hover:text-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      
      {syncingAll ? (
        <>
          
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Syncing
          all accounts…
        </>
      ) : (
        <>
          
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Sync all
          accounts
        </>
      )}
    </button>
  );
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
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bip-accent/15 text-bip-accent">
                
                <Megaphone className="h-5 w-5" aria-hidden />
              </div>
              <div>
                
                <h1 className="text-lg font-semibold tracking-tight text-white">
                  
                  Global Google Ads Optimization Center
                </h1>
                <p className="mt-0.5 text-xs text-white/50">
                  
                  Cross-account diagnostic radar ·
                  {userEmail ?? "Signed in"}
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-white/50">
              
              Scanned {coverage.syncedAccountCount} of
              {coverage.syncableAccountCount} syncable Google Ads accounts (
              {coverage.totalClients} clients total).{""}
              {formatSyncTime(lastAdsSyncAt)}.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            
            <Link
              href="/conversion-integrity"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
            >
              
              Conversion Radar
            </Link>
            <Link
              href="/ppc-defense"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
            >
              
              PPC Defense
            </Link>
            {syncAllButton}
            <PlaybookGuidancePanel
              variant="drawer"
              sections={GLOBAL_ADS_PLAYBOOK_SECTIONS}
            />
            <AppHeaderActions />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        
        {loadError ? (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            
            {loadError}
          </div>
        ) : null}
        {syncAllMessage ? (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${syncAllMessage.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-red-500/20 bg-red-500/10 text-red-200"}`}
          >
            
            {syncAllMessage.text}
          </div>
        ) : null}
        {coverage.syncedAccountCount < coverage.syncableAccountCount ? (
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            
            <div className="flex flex-wrap items-start justify-between gap-3">
              
              <div className="min-w-0 flex-1">
                
                <p className="font-medium">Limited ads coverage</p>
                <p className="mt-1 text-xs text-amber-200/80">
                  
                  {coverage.syncableAccountCount -
                    coverage.syncedAccountCount}
                  syncable account
                  {coverage.syncableAccountCount -
                    coverage.syncedAccountCount ===
                  1
                    ? ""
                    : "s"}
                  {""}
                  {coverage.syncedAccountCount === 0 ? "have" : "still need"}
                  never been ads-synced. Use Sync all accounts to pull every
                  syncable client at once, or sync individually from a client
                  workspace. Placeholder IDs like &ldquo;N&rdquo; are excluded (
                  {coverage.totalClients - coverage.syncableAccountCount}
                  clients without a valid 10-digit Ads customer ID).
                </p>
              </div>
              {syncAllButton}
            </div>
          </div>
        ) : null}
        {coverage.syncFailedAccountCount > 0 ? (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            
            <p className="font-medium">
              
              {coverage.syncFailedAccountCount} synced account
              {coverage.syncFailedAccountCount === 1 ? "" : "s"} with failed
              latest sync
            </p>
            <p className="mt-1 text-xs text-red-200/80">
              
              These won&apos;t show optimization issues until sync succeeds.
              Check the Ads customer ID and MCC access, then re-sync from the
              client workspace.
            </p>
          </div>
        ) : null}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          
          <div className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              
              Syncable
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {coverage.syncableAccountCount}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              
              Synced
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {coverage.syncedAccountCount}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              
              With issues
            </p>
            <p className="mt-1 text-xl font-bold text-amber-400">
              {summary.accountsWithIssues}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              
              Healthy
            </p>
            <p className="mt-1 text-xl font-bold text-bip-accent">
              
              {coverage.healthySyncedAccountCount}
            </p>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            
            <div className="flex items-center justify-between">
              
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                
                Critical Budget / Rank Loss
              </span>
              <Coins size={16} className="text-red-400" />
            </div>
            <p className="mt-2 text-3xl font-bold text-white">
              
              {summary.budgetCappedAccountCount}
              {""}
              <span className="text-xs font-normal text-white/50">
                accounts affected
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            
            <div className="flex items-center justify-between">
              
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                
                Relevance / CTR / QS Deficits
              </span>
              <Target size={16} className="text-amber-400" />
            </div>
            <p className="mt-2 text-3xl font-bold text-white">
              
              {summary.relevanceCtrAccountCount}
              {""}
              <span className="text-xs font-normal text-white/50">
                accounts flagged
              </span>
            </p>
          </div>
        </div>
        <div className="mb-8 rounded-xl border border-white/[0.08] bg-bip-card/50 p-4">
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
              
              <Filter size={12} /> Active View Filters
            </span>
            <div className="flex items-center gap-2">
              
              <button
                type="button"
                onClick={selectAllFilters}
                className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/50 transition hover:bg-bip-card/60 hover:text-white/75"
              >
                
                Select all
              </button>
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-white/50 transition hover:bg-bip-card/60 hover:text-white/75"
              >
                
                Clear all
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            
            {FILTER_OPTIONS.map((option) => {
              const checked = selectedFilters.has(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition ${checked ? "border-indigo-500/30 bg-bip-accent/10 text-white/75" : "border-white/[0.08] bg-bip-card/40 text-white/50 hover:border-white/[0.12]"}`}
                >
                  
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFilter(option.value)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-bip-card text-indigo-500 focus:ring-0 focus:ring-offset-0"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between gap-3">
          
          <p className="text-xs text-white/50">
            
            {selectedFilters.size === 0 ? (
              "Select at least one filter to view issues"
            ) : (
              <>
                
                {filteredIssues.length} issue
                {filteredIssues.length === 1 ? "" : "s"} ·{""}
                {summary.accountsWithIssues} account
                {summary.accountsWithIssues === 1 ? "" : "s"} with active repair
                points
              </>
            )}
          </p>
          <button
            type="button"
            onClick={cycleSortKey}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs font-medium text-white/50 transition hover:bg-bip-card/60 hover:text-white/75"
          >
            
            <ArrowUpDown size={12} /> Sort:
            {sortKey === "severity"
              ? "Severity"
              : sortKey === "account"
                ? "Account"
                : "Category"}
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-bip-card/40">
          
          {selectedFilters.size === 0 ? (
            <div className="px-6 py-16 text-center">
              
              <p className="text-sm font-medium text-white/75">
                No filters selected
              </p>
              <p className="mt-1 text-xs text-white/50">
                
                Tick one or more anomaly categories above to populate the repair
                queue.
              </p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="px-6 py-16 text-center">
              
              <p className="text-sm font-medium text-white/75">
                No optimization gaps detected
              </p>
              <p className="mt-1 text-xs text-white/50">
                
                Connected accounts are clear for the selected filters, or no ads
                snapshots are available yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              
              <table className="w-full text-left text-sm text-white/75"><thead className="border-b border-white/[0.08] bg-bip-card/40 text-xs font-semibold uppercase tracking-wider text-white/50"><tr><th className="p-4">Client Account Name</th><th className="p-4">Anomalous Category</th><th className="p-4">Impacted Metric Focus</th><th className="p-4">Projected Health Impact</th><th className="p-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-800/60">{filteredIssues.map((item) => {
                    const optimizeTarget = buildGoogleAdsOptimizeTarget(item);
                    return (
                      <tr
                        key={item.id}
                        className="transition hover:bg-bip-card/20"
                      ><td className="p-4 font-medium text-white/75">
                          
                          <Link
                            href={optimizeTarget.workspaceUrl}
                            className="hover:text-bip-accent"
                          >
                            
                            {item.accountName}
                          </Link>
                          <div className="mt-0.5 font-mono text-[11px] text-white/50">
                            
                            {item.accountIdLabel}
                            {optimizeTarget.formattedCustomerId
                              ? ` · Ads ${optimizeTarget.formattedCustomerId}`
                              : null}
                          </div>
                        </td><td className="p-4">
                          
                          <span
                            className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityBadgeClass(item.severity)}`}
                          >
                            
                            {item.issueLabel}
                          </span>
                          {globalAdsIssueToPlaybook(item.issueType) ? (
                            <PlaybookInlineTrigger
                              issueType={
                                globalAdsIssueToPlaybook(item.issueType)!
                              }
                            />
                          ) : null}
                        </td><td className="p-4 font-mono text-xs text-white/50">
                          {item.target}
                        </td><td className="p-4 text-xs text-white/50">
                          {item.impact}
                        </td><td className="p-4 text-right">
                          
                          <div className="flex flex-col items-end gap-1.5">
                            
                            {optimizeTarget.externalUrl ? (
                              <a
                                href={optimizeTarget.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                title={`Open ${optimizeTarget.destinationLabel} in Google Ads`}
                                className="inline-flex items-center gap-1 rounded-md border border-indigo-500/10 bg-bip-accent/5 px-2.5 py-1.5 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/10 hover:text-bip-accent"
                              >
                                
                                Optimize in Google Ads
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              <Link
                                href={optimizeTarget.workspaceUrl}
                                className="inline-flex items-center gap-1 rounded-md border border-indigo-500/10 bg-bip-accent/5 px-2.5 py-1.5 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/10 hover:text-bip-accent"
                              >
                                
                                Optimize in BIP <ArrowRight size={12} />
                              </Link>
                            )}
                            {optimizeTarget.externalUrl ? (
                              <Link
                                href={optimizeTarget.workspaceUrl}
                                className="text-[10px] text-white/50 transition hover:text-white/75"
                              >
                                
                                View in BIP workspace
                              </Link>
                            ) : null}
                          </div>
                        </td></tr>
                    );
                  })}
                </tbody></table>
            </div>
          )}
        </div>
        <PlaybookGuidancePanel
          variant="accordion"
          sections={GLOBAL_ADS_PLAYBOOK_SECTIONS}
          className="mt-8"
        />
      </main>
    </div>
  );
}
