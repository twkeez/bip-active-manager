"use client";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Layers,
  PenTool,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  buildSmartAdsPlaybook,
  describeAdGroups,
  type SmartPlaybookTask,
} from "@/lib/ads/smart-playbook";
import type { AdsSnapshot } from "@/lib/types/client";
const panelClass =
  "rounded-xl border border-white/[0.08] bg-bip-card/50 text-white";
const taskCardClass =
  "flex flex-col items-start justify-between gap-4 rounded-xl border border-white/[0.08] bg-bip-card/40 p-5 transition hover:border-white/[0.08] md:flex-row md:items-center";
type SmartAdsPlaybookProps = {
  adsSnapshot: AdsSnapshot;
  clientName?: string;
  className?: string;
  embedded?: boolean;
};
function KeywordInlineList({
  keywords,
  max = 4,
}: {
  keywords: string[];
  max?: number;
}) {
  const shown = keywords.slice(0, max);
  const overflow = keywords.length - shown.length;
  return (
    <>
      
      {shown.map((keyword, index) => (
        <span key={keyword}>
          
          <span className="font-mono text-white/75">
            &quot;{keyword}&quot;
          </span>
          {index < shown.length - 2 ? "," : null}
          {index === shown.length - 2 && shown.length > 1 ? " and" : null}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="text-white/50"> (+{overflow} more)</span>
      ) : null}
    </>
  );
}
function buildBudgetEmailDraft(
  clientName: string | undefined,
  lostPct: number,
  averageCpc: number | null,
) {
  const cpcLine =
    averageCpc != null && averageCpc > 0
      ? `At your current ~$${averageCpc.toFixed(2)} average CPC, even a modest daily budget increase could recover meaningful qualified traffic without changing bids.`
      : "Even a modest daily budget increase could recover meaningful qualified traffic without changing bids.";
  return [
    `Subject: Google Ads budget opportunity — ${clientName ?? "your account"}`,
    "",
    `Hi team,`,
    "",
    `Our latest Google Ads sync shows we're missing about ${lostPct.toFixed(2)}% of eligible search impression share due to daily budget caps (Lost IS — Budget).`,
    "",
    cpcLine,
    "",
    `Would you be open to a ~${Math.round(lostPct)}% budget expansion on the primary Search campaigns so we can capture more of this demand?`,
    "",
    `Happy to walk through the numbers on our next check-in.`,
  ].join("\n");
}
export default function SmartAdsPlaybook({
  adsSnapshot,
  clientName,
  className = "",
  embedded = false,
}: SmartAdsPlaybookProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [snoozed, setSnoozed] = useState<Set<string>>(() => new Set());
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const tasks = useMemo(
    () =>
      buildSmartAdsPlaybook({
        keywordQuality: adsSnapshot.keyword_quality,
        searchBudgetLostImpressionShare:
          adsSnapshot.totals.search_budget_lost_impression_share,
        averageCpc: adsSnapshot.totals.average_cpc,
      }),
    [adsSnapshot],
  );
  const visibleTasks = tasks.filter(
    (task) => !dismissed.has(task.kind) && !snoozed.has(task.kind),
  );
  async function copyBudgetEmail(
    task: Extract<SmartPlaybookTask, { kind: "budget" }>,
  ) {
    const text = buildBudgetEmailDraft(
      clientName,
      task.lostImpressionSharePct,
      task.averageCpc,
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("Email draft copied.");
    } catch {
      setCopyFeedback("Could not copy — select and copy manually.");
    }
    window.setTimeout(() => setCopyFeedback(null), 2500);
  }
  const rootClass = embedded
    ? className
    : `${panelClass} p-6 ${className}`.trim();
  const header = (
    <div className="mb-6 flex items-center gap-2 border-b border-white/[0.08] pb-3">
      
      <Sparkles className="fill-indigo-400/20 text-bip-accent" size={18} />
      <div>
        
        <h3 className="text-base font-semibold text-white">
          Smart Optimization Playbook
        </h3>
        <p className="text-xs text-white/50">
          
          {visibleTasks.length === 0
            ? "No grouped interventions from the latest quality score flags or budget caps."
            : "Automated campaign interventions based on latest quality score flags."}
        </p>
      </div>
    </div>
  );
  if (visibleTasks.length === 0) {
    return <div className={rootClass}> {header} </div>;
  }
  return (
    <div className={rootClass}>
      
      {header}
      <div className="space-y-4">
        
        {visibleTasks.map((task) => {
          if (task.kind === "ad_relevance") {
            return (
              <div key={task.kind} className={taskCardClass}>
                
                <div className="space-y-1">
                  
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                    
                    <PenTool size={14} /> Ad Copy Relevance Gap
                  </div>
                  <h4 className="text-sm font-medium text-white">
                    
                    Inject Missing Keywords into Headlines
                  </h4>
                  <p className="max-w-xl text-xs text-white/50">
                    
                    The keywords <KeywordInlineList
                      keywords={task.keywords}
                    />
                    have below-average relevance matching. Add them explicitly
                    into your active responsive search ad headlines to boost
                    Quality Score.
                  </p>
                </div>
                <div className="flex w-full shrink-0 gap-2 md:w-auto">
                  
                  <a
                    href="https://ads.google.com/aw/adwords/express/campaigns"
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-bip-accent px-3 py-2 text-xs font-medium text-white transition hover:bg-bip-accent md:flex-initial"
                  >
                    
                    Edit Ad Copy <ArrowRight size={12} />
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      setDismissed((prev) => new Set(prev).add(task.kind))
                    }
                    className="flex-1 rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2 text-xs font-medium text-white/50 transition hover:bg-bip-card/70 md:flex-initial"
                  >
                    
                    Ignore
                  </button>
                </div>
              </div>
            );
          }
          if (task.kind === "expected_ctr") {
            return (
              <div key={task.kind} className={taskCardClass}>
                
                <div className="space-y-1">
                  
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                    
                    <Layers size={14} /> CTR Optimization
                  </div>
                  <h4 className="text-sm font-medium text-white">
                    
                    Deploy Visual Sitelink &amp; Callout Extensions
                  </h4>
                  <p className="max-w-xl text-xs text-white/50">
                    
                    Expected CTR is lagging for{""}
                    <span className="text-white/75">
                      {describeAdGroups(task.adGroupNames)}
                    </span>
                    {task.keywords.length > 0 ? (
                      <>
                        
                        {""} (e.g.
                        <KeywordInlineList
                          keywords={task.keywords.slice(0, 2)}
                          max={2}
                        />
                        ). Setting up 2 new visual sitelink assets will improve
                        click probabilities without raising your keyword
                        bids.
                      </>
                    ) : (
                      ". Setting up 2 new visual sitelink assets will improve click probabilities without raising your keyword bids."
                    )}
                  </p>
                </div>
                <div className="flex w-full shrink-0 gap-2 md:w-auto">
                  
                  <a
                    href="https://ads.google.com/aw/adextensions"
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 rounded-lg border border-white/[0.08] bg-bip-card/40 px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-bip-card/70 md:flex-initial"
                  >
                    
                    Manage Extensions
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      setSnoozed((prev) => new Set(prev).add(task.kind))
                    }
                    className="flex-1 rounded-lg bg-bip-card/30 px-3 py-2 text-xs font-medium text-white/50 transition hover:bg-bip-card/50 md:flex-initial"
                  >
                    
                    Snooze
                  </button>
                </div>
              </div>
            );
          }
          const expansionPct = Math.round(task.lostImpressionSharePct);
          return (
            <div key={task.kind} className={taskCardClass}>
              
              <div className="space-y-1">
                
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-bip-accent">
                  
                  <TrendingUp size={14} /> Impression Share Capture
                </div>
                <h4 className="text-sm font-medium text-white">
                  
                  Request {expansionPct}% Budget Expansion Allocation
                </h4>
                <p className="max-w-xl text-xs text-white/50">
                  
                  Campaign budget limits are artificially shutting off your ads
                  prematurely, missing exactly
                  {task.lostImpressionSharePct.toFixed(2)}% of local searches.
                  {task.averageCpc != null && task.averageCpc > 0 ? (
                    <>
                      
                      {""} Increasing current daily caps could capture
                      additional qualified traffic at your steady baseline $
                      {task.averageCpc.toFixed(2)} CPC cost tier.
                    </>
                  ) : (
                    " Increasing current daily caps could capture additional qualified traffic at your current CPC tier."
                  )}
                </p>
              </div>
              <div className="flex w-full shrink-0 gap-2 md:w-auto">
                
                <button
                  type="button"
                  onClick={() => copyBudgetEmail(task)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-bip-accent/15 px-3 py-2 text-xs font-medium text-bip-accent transition hover:bg-bip-accent/25 md:flex-initial"
                >
                  
                  Draft Email to Client
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {copyFeedback ? (
        <p className="mt-3 text-xs text-bip-accent">{copyFeedback}</p>
      ) : null}
    </div>
  );
}
export { buildSmartAdsPlaybook } from "@/lib/ads/smart-playbook";
