"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertOctagon,
  ArrowRight,
  Flame,
  LayoutGrid,
  PanelTop,
  ShieldCheck,
} from "lucide-react";
import AppHeaderActions from "@/components/layout/app-header-actions";
import PlaybookGuidancePanel, {
  PlaybookInlineTrigger,
} from "@/components/dashboard/playbook-guidance-panel";
import {
  buildWebDevExportPayload,
  budgetHogDollars,
  type BudgetHogItem,
  type LpDeficitItem,
  type PpcDefenseSummary,
} from "@/lib/ads/ppc-defense";
import { PPC_DEFENSE_PLAYBOOK_SECTIONS } from "@/lib/playbooks/content";
type Props = {
  lpDeficits: LpDeficitItem[];
  budgetHogs: BudgetHogItem[];
  summary: PpcDefenseSummary;
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
export default function PpcDefenseRadar({
  lpDeficits,
  budgetHogs,
  summary,
  lastAdsSyncAt,
  userEmail,
  loadError,
}: Props) {
  const [resolvedHogIds, setResolvedHogIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const visibleHogs = useMemo(
    () => budgetHogs.filter((item) => !resolvedHogIds.has(item.id)),
    [budgetHogs, resolvedHogIds],
  );
  async function handleExportWebDev() {
    const payload = buildWebDevExportPayload(lpDeficits);
    try {
      await navigator.clipboard.writeText(payload);
      setExportMessage("Web dev assignment copied to clipboard.");
    } catch {
      setExportMessage(
        "Could not copy — select and copy manually from console.",
      );
      console.info(payload);
    }
    window.setTimeout(() => setExportMessage(null), 3000);
  }
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-bip-page font-sans text-white">
      
      <header className="border-b border-white/[0.08] px-6 py-5">
        
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          
          <div className="min-w-0">
            
            <div className="flex items-center gap-3">
              
              <Link
                href="/dashboard"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-bip-card/50 text-white/75 transition hover:bg-bip-card/60"
                title="Control panel"
              >
                
                <LayoutGrid className="h-4 w-4" aria-hidden />
              </Link>
              <div>
                
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  
                  PPC Protection &amp; Defense Radar
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  
                  Cross-account operational center ·
                  {userEmail ?? "Signed in"}
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-white/50">
              
              Optimizing quality scores and containing runaway budget burn
              across{""} {summary.accountsScanned} synced accounts (
              {summary.keywordsScanned} keywords scanned).
              {formatSyncTime(lastAdsSyncAt)}.
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
              sections={PPC_DEFENSE_PLAYBOOK_SECTIONS}
            />
            <AppHeaderActions />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 p-6">
        
        {loadError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            
            {loadError}
          </div>
        ) : null}
        {exportMessage ? (
          <div className="rounded-xl border border-indigo-500/20 bg-bip-accent/10 px-4 py-3 text-sm text-indigo-200">
            
            {exportMessage}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          
          <div className="rounded-lg border border-indigo-500/20 bg-bip-accent/10 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-bip-accent">
              
              LP deficits
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {summary.lpDeficitCount}
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              
              Budget hogs
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {visibleHogs.length}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              
              LP accounts
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {summary.lpAccountsAffected}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2">
            
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              
              Hog accounts
            </p>
            <p className="mt-1 text-xl font-bold text-white">
              {summary.hogAccountsAffected}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          
          <section className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-bip-card/40 p-6">
            
            <div>
              
              <div className="mb-4 flex items-center justify-between gap-2">
                
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-bip-accent">
                  
                  <PanelTop size={16} /> 1. Landing Page Experience Deficit
                  Radar
                </div>
                <span className="rounded-full border border-indigo-500/20 bg-bip-accent/10 px-2 py-0.5 text-[11px] font-medium text-bip-accent">
                  
                  Internal Cross-Team Sync Item
                </span>
              </div>
              <p className="mb-6 text-xs leading-relaxed text-white/50">
                
                Identifies destination URLs flagged by Google as providing a
                poor user experience. Low landing page scores artificially spike
                your Cost-Per-Click (CPC), acting as a direct tax on client ad
                spend.
              </p>
              <div className="space-y-3">
                
                {lpDeficits.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.08] bg-bip-card/30 p-6 text-center text-xs text-white/50">
                    
                    <ShieldCheck size={14} className="text-emerald-500/60" /> No
                    landing page experience deficits detected in synced
                    accounts.
                  </div>
                ) : (
                  lpDeficits.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between rounded-lg border border-white/[0.08] bg-bip-card/50 p-4"
                    >
                      
                      <div className="min-w-0 space-y-1">
                        
                        <Link
                          href={`/dashboard/clients/${item.clientId}?tab=ads`}
                          className="text-sm font-semibold text-white/75 hover:text-bip-accent"
                        >
                          
                          {item.accountName}
                        </Link>
                        <p className="text-xs text-white/50">
                          
                          Campaign:{""}
                          <span className="font-mono text-white/75">
                            {item.campaignName}
                          </span>
                          · Target:{""}
                          <span className="font-mono font-bold text-amber-400">
                            
                            &ldquo;{item.keyword}&rdquo;
                          </span>
                        </p>
                        <p className="text-[10px] text-white/50">
                          
                          {item.accountIdLabel} · {item.costLabel} keyword spend
                          (30d)
                        </p>
                        <PlaybookInlineTrigger issueType="landingPage" />
                      </div>
                      <span className="whitespace-nowrap rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                        
                        {item.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end border-t border-white/[0.08] pt-4">
              
              <button
                type="button"
                onClick={() => void handleExportWebDev()}
                disabled={lpDeficits.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-bip-card/40 px-4 py-2 text-xs font-medium text-white/75 transition hover:bg-bip-card/70 disabled:opacity-50"
              >
                
                Export assignment to web dev team <ArrowRight size={12} />
              </button>
            </div>
          </section>
          <section className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-bip-card/40 p-6">
            
            <div>
              
              <div className="mb-4 flex items-center justify-between gap-2">
                
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  
                  <Flame size={16} /> 2. Runaway &ldquo;Budget Hog&rdquo; Alert
                  System
                </div>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                  
                  Threshold: &gt;30% spend &amp; &lt;2 conversions
                </span>
              </div>
              <p className="mb-6 text-xs leading-relaxed text-white/50">
                
                Flags top-heavy informational keywords that dominate an
                account&apos;s running click budget without producing direct
                transactional outcomes.
              </p>
              <div className="space-y-3">
                
                {visibleHogs.map((item) => (
                  <div
                    key={item.id}
                    className="space-y-4 rounded-lg border border-red-500/20 bg-bip-card/70 p-4"
                  >
                    
                    <div className="flex items-start justify-between gap-3">
                      
                      <div>
                        
                        <Link
                          href={`/dashboard/clients/${item.clientId}?tab=ads`}
                          className="text-sm font-semibold text-white/75 hover:text-bip-accent"
                        >
                          
                          {item.accountName}
                        </Link>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-red-400">
                          
                          <AlertOctagon size={12} /> Keyword consuming
                          {item.pctOfBudgetLabel} of total account volume
                        </p>
                      </div>
                      <span className="text-sm font-bold text-white">
                        
                        ${budgetHogDollars(item.keywordSpendMicros).toFixed(2)}
                        {""}
                        <span className="text-[10px] font-normal text-white/50">
                          spent
                        </span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded border border-white/[0.08] bg-bip-card/40 p-2.5 text-center text-xs">
                      
                      <div>
                        
                        <p className="text-[10px] uppercase text-white/50">
                          Hog keyword
                        </p>
                        <p className="mt-0.5 font-mono font-semibold text-white/75">
                          
                          &ldquo;{item.keyword}&rdquo;
                        </p>
                      </div>
                      <div>
                        
                        <p className="text-[10px] uppercase text-white/50">
                          Conversions
                        </p>
                        <p className="mt-0.5 font-bold text-red-400">
                          {item.conversions}
                        </p>
                      </div>
                      <div>
                        
                        <p className="text-[10px] uppercase text-white/50">
                          Total account run
                        </p>
                        <p className="mt-0.5 font-mono text-white/50">
                          
                          $
                          {budgetHogDollars(item.totalSpendMicros).toFixed(
                            2,
                          )}
                        </p>
                      </div>
                    </div>
                    <PlaybookInlineTrigger issueType="budgetHog" />
                    <div className="flex justify-end gap-2 pt-1">
                      
                      <button
                        type="button"
                        onClick={() =>
                          setResolvedHogIds((current) =>
                            new Set(current).add(item.id),
                          )
                        }
                        className="rounded border border-white/[0.08]/40 bg-bip-card/40 px-3 py-1.5 text-[11px] font-medium text-white/50 transition hover:bg-bip-card/70"
                      >
                        
                        Convert to negative match
                      </button>
                      <Link
                        href={`/dashboard/clients/${item.clientId}?tab=ads`}
                        className="rounded bg-amber-600 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-amber-500"
                      >
                        
                        Isolate match type
                      </Link>
                    </div>
                  </div>
                ))}
                {visibleHogs.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-900/20 bg-emerald-950/10 p-4 text-center text-xs text-white/50">
                    
                    <ShieldCheck size={14} className="text-emerald-500" /> All
                    cross-account keywords are tracking inside optimal
                    efficiency allocations.
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
        <PlaybookGuidancePanel
          variant="accordion"
          sections={PPC_DEFENSE_PLAYBOOK_SECTIONS}
        />
      </main>
    </div>
  );
}
