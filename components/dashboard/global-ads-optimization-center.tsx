"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LayoutGrid,
  Loader2,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import AppHeaderActions from "@/components/layout/app-header-actions";
import { buildGoogleAdsOptimizeTarget } from "@/lib/ads/google-ads-ui-links";
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
  { value: "ad_relevance", label: "Ad Relevance" },
  { value: "expected_ctr", label: "Expected CTR" },
  { value: "low_quality_score", label: "Quality Score" },
  { value: "budget_capped", label: "Budget Limits" },
  { value: "rank_lost", label: "Ad Rank Loss" },
];

const ALL_ISSUE_TYPES = FILTER_OPTIONS.map((o) => o.value);

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2 } as const;

const ISSUE_PLAIN_LABEL: Record<GlobalAdsIssueType, string> = {
  ad_relevance: "Ad relevance gap",
  expected_ctr: "Low expected CTR",
  low_quality_score: "Low quality score",
  budget_capped: "Budget capped",
  rank_lost: "Ad rank loss",
};

function formatSyncAge(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const hours = Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60));
  if (hours < 1) return "synced less than 1 hour ago";
  if (hours < 24) return `synced ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `synced ${days}d ago`;
}

function severityDotClass(severity: GlobalAdsIssue["severity"]) {
  if (severity === "critical") return "bg-red-400";
  if (severity === "high") return "bg-amber-400";
  return "bg-slate-500";
}

function severityLabel(severity: GlobalAdsIssue["severity"]) {
  if (severity === "critical") return "Critical";
  if (severity === "high") return "High";
  return "Medium";
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
  const [selectedFilters, setSelectedFilters] = useState<Set<GlobalAdsIssueType>>(
    () => new Set(ALL_ISSUE_TYPES),
  );
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllMessage, setSyncAllMessage] = useState<SyncAllMessage | null>(null);

  function toggleFilter(type: GlobalAdsIssueType) {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const filteredIssues = useMemo(() => {
    const filtered = issues.filter((i) => selectedFilters.has(i.issueType));
    return [...filtered].sort((a, b) => {
      if (sortKey === "account") {
        const by = a.accountName.localeCompare(b.accountName);
        return by !== 0 ? by : b.sortWeight - a.sortWeight;
      }
      if (sortKey === "category") {
        const by = a.issueLabel.localeCompare(b.issueLabel);
        return by !== 0 ? by : b.sortWeight - a.sortWeight;
      }
      const sd = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      return sd !== 0 ? sd : b.sortWeight - a.sortWeight;
    });
  }, [issues, selectedFilters, sortKey]);

  function cycleSortKey() {
    setSortKey((k) => (k === "severity" ? "account" : k === "account" ? "category" : "severity"));
  }

  async function handleSyncAll() {
    setSyncingAll(true);
    setSyncAllMessage(null);
    try {
      const res = await fetch("/api/ads/sync-all", { method: "POST" });
      const payload = (await res.json()) as {
        error?: string;
        synced?: number;
        failed?: number;
        skipped?: number;
      };
      if (!res.ok) throw new Error(payload.error ?? "Sync failed");
      const { synced = 0, failed = 0, skipped = 0 } = payload;
      setSyncAllMessage({
        type: failed > 0 ? "error" : "success",
        text: `Sync complete: ${synced} synced${failed > 0 ? `, ${failed} failed` : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}.`,
      });
      router.refresh();
    } catch (err) {
      setSyncAllMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Sync failed",
      });
    } finally {
      setSyncingAll(false);
    }
  }

  const unsyncedCount = coverage.syncableAccountCount - coverage.syncedAccountCount;
  const syncAgeLabel = formatSyncAge(lastAdsSyncAt);
  const activeFilterCount = selectedFilters.size;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-bip-page font-sans text-bip-text">

      {/* Header */}
      <header className="border-b border-bip-border px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bip-border bg-bip-card/50 text-bip-text transition hover:bg-bip-card/60"
              title="Dashboard"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </Link>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bip-accent/15 text-bip-accent">
              <Megaphone className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-bip-text">
                Global Ads Optimization
              </h1>
              <p className="text-xs text-bip-muted">
                {coverage.syncedAccountCount} of {coverage.syncableAccountCount} accounts synced
                {syncAgeLabel ? ` · ${syncAgeLabel}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/conversion-integrity"
              className="rounded-lg border border-bip-border px-3 py-1.5 text-xs font-medium text-bip-muted transition hover:text-bip-text"
            >
              Conversion Radar
            </Link>
            <Link
              href="/ppc-defense"
              className="rounded-lg border border-bip-border px-3 py-1.5 text-xs font-medium text-bip-muted transition hover:text-bip-text"
            >
              PPC Defense
            </Link>
            <button
              type="button"
              onClick={() => void handleSyncAll()}
              disabled={syncingAll || coverage.syncableAccountCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bip-accent/30 bg-bip-accent/10 px-3 py-1.5 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncingAll ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing…</>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5" /> Sync all</>
              )}
            </button>
            <AppHeaderActions />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">

        {/* Error / status banners */}
        {loadError && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {loadError}
          </div>
        )}
        {syncAllMessage && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${syncAllMessage.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-red-500/20 bg-red-500/10 text-red-200"}`}>
            {syncAllMessage.text}
          </div>
        )}
        {unsyncedCount > 0 && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="text-amber-200">
              <span className="font-medium">{unsyncedCount} account{unsyncedCount !== 1 ? "s" : ""} not yet synced.</span>
              {" "}Use <span className="font-medium">Sync all</span> to pull the latest data, or sync individually from each client.
            </p>
          </div>
        )}
        {coverage.syncFailedAccountCount > 0 && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <span className="font-medium">{coverage.syncFailedAccountCount} account{coverage.syncFailedAccountCount !== 1 ? "s" : ""} failed their last sync.</span>
            {" "}Check the Ads customer ID and MCC access, then re-sync from the client workspace.
          </div>
        )}

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          {[
            { label: "Syncable", value: coverage.syncableAccountCount, color: "text-bip-text" },
            { label: "Synced", value: coverage.syncedAccountCount, color: "text-bip-text" },
            { label: "With issues", value: summary.accountsWithIssues, color: "text-amber-400" },
            { label: "Healthy", value: coverage.healthySyncedAccountCount, color: "text-emerald-400" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-bip-border bg-bip-card/40 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-bip-muted">{stat.label}</p>
              <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filter + sort bar */}
        <div className="mb-4 rounded-xl border border-bip-border bg-bip-card/40">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-bip-muted hover:text-bip-text transition-colors"
          >
            <span>
              Filters
              {activeFilterCount < ALL_ISSUE_TYPES.length && (
                <span className="ml-2 rounded-full border border-bip-accent/30 bg-bip-accent/10 px-1.5 py-0.5 text-[10px] text-bip-accent">
                  {activeFilterCount} of {ALL_ISSUE_TYPES.length} active
                </span>
              )}
            </span>
            {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {filtersOpen && (
            <div className="border-t border-bip-border px-4 pb-4 pt-3">
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((opt) => {
                  const active = selectedFilters.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleFilter(opt.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                        active
                          ? "border-bip-accent/30 bg-bip-accent/10 text-bip-text"
                          : "border-bip-border bg-bip-card/30 text-bip-subtle hover:text-bip-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSelectedFilters(new Set(ALL_ISSUE_TYPES))}
                  className="ml-auto rounded-lg border border-bip-border px-3 py-1.5 text-xs text-bip-subtle hover:text-bip-muted transition"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFilters(new Set())}
                  className="rounded-lg border border-bip-border px-3 py-1.5 text-xs text-bip-subtle hover:text-bip-muted transition"
                >
                  None
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Issues table */}
        <div className="rounded-xl border border-bip-border bg-bip-card/40 overflow-hidden">

          {/* Table header with count + sort */}
          <div className="flex items-center justify-between border-b border-bip-border px-4 py-3">
            <p className="text-xs text-bip-muted">
              {selectedFilters.size === 0
                ? "No filters selected"
                : `${filteredIssues.length} issue${filteredIssues.length !== 1 ? "s" : ""} across ${summary.accountsWithIssues} account${summary.accountsWithIssues !== 1 ? "s" : ""}`}
            </p>
            <button
              type="button"
              onClick={cycleSortKey}
              className="inline-flex items-center gap-1.5 rounded-lg border border-bip-border px-2.5 py-1.5 text-xs text-bip-muted transition hover:text-bip-muted"
            >
              <ArrowUpDown size={11} />
              Sort: {sortKey === "severity" ? "Severity" : sortKey === "account" ? "Client" : "Issue type"}
            </button>
          </div>

          {selectedFilters.size === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-bip-muted">Select at least one filter to see issues.</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-bip-muted">No issues found</p>
              <p className="mt-1 text-xs text-bip-subtle">
                All synced accounts are clear for the selected filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-bip-border">
                  <tr className="text-[10px] font-semibold uppercase tracking-wider text-bip-subtle">
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Issue</th>
                    <th className="px-4 py-3">What&apos;s affected</th>
                    <th className="px-4 py-3">Why it matters</th>
                    <th className="px-4 py-3 text-right">Fix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredIssues.map((item) => {
                    const target = buildGoogleAdsOptimizeTarget(item);
                    return (
                      <tr key={item.id} className="transition hover:bg-bip-hover">

                        {/* Client */}
                        <td className="px-4 py-3">
                          <Link
                            href={target.workspaceUrl}
                            className="font-medium text-bip-text hover:text-bip-accent transition-colors"
                          >
                            {item.accountName}
                          </Link>
                          {target.formattedCustomerId && (
                            <p className="mt-0.5 font-mono text-[10px] text-bip-subtle">
                              {target.formattedCustomerId}
                            </p>
                          )}
                        </td>

                        {/* Issue */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${severityDotClass(item.severity)}`} />
                            <span className="text-bip-text text-xs">
                              {ISSUE_PLAIN_LABEL[item.issueType] ?? item.issueLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 pl-3.5 text-[10px] text-bip-subtle">
                            {severityLabel(item.severity)}
                          </p>
                        </td>

                        {/* What's affected */}
                        <td className="px-4 py-3 font-mono text-xs text-bip-muted">
                          {item.target}
                        </td>

                        {/* Why it matters */}
                        <td className="px-4 py-3 text-xs text-bip-muted max-w-[200px]">
                          {item.impact}
                        </td>

                        {/* Fix */}
                        <td className="px-4 py-3 text-right">
                          {target.externalUrl ? (
                            <div className="flex flex-col items-end gap-1">
                              <a
                                href={target.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-bip-accent/20 bg-bip-accent/8 px-2.5 py-1.5 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/15"
                              >
                                Fix in Google Ads <ExternalLink size={11} />
                              </a>
                              <Link
                                href={target.workspaceUrl}
                                className="text-[10px] text-bip-subtle hover:text-bip-muted transition-colors"
                              >
                                Open client →
                              </Link>
                            </div>
                          ) : (
                            <Link
                              href={target.workspaceUrl}
                              className="inline-flex items-center gap-1 rounded-lg border border-bip-accent/20 bg-bip-accent/8 px-2.5 py-1.5 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/15"
                            >
                              Open client <ArrowRight size={11} />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
