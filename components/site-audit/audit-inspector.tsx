"use client";
import { useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  Zap,
} from "lucide-react";
import type {
  InspectorIssue,
  InspectorPriority,
  InspectorTab,
} from "@/lib/site-audit/inspector-issues";
import { summarizeInspectorIssues } from "@/lib/site-audit/inspector-issues";
const TAB_LABELS: Record<InspectorTab, string> = {
  seo: "Content & On-Page SEO",
  performance: "Performance & Vitals",
  code: "Code Optimization",
};
const TAB_ICONS: Record<
  InspectorTab,
  ComponentType<{ size?: number; className?: string }>
> = { seo: ShieldAlert, performance: Zap, code: Sliders };
const PRIORITY_BADGE: Record<
  InspectorPriority,
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  high: {
    label: "High Priority",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  medium: {
    label: "Minor Adjust",
    className: "bg-slate-700 text-white/75 border-slate-600",
  },
};
export default function AuditInspector({
  issues,
  passedChecks = 0,
  selectedKeys,
  onToggleSelect,
}: {
  issues: InspectorIssue[];
  passedChecks?: number;
  selectedKeys?: Set<string>;
  onToggleSelect?: (issue: InspectorIssue) => void;
}) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("seo");
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  const summary = useMemo(
    () => summarizeInspectorIssues(issues, passedChecks),
    [issues, passedChecks],
  );
  const filteredIssues = useMemo(
    () => issues.filter((issue) => issue.tab === activeTab),
    [issues, activeTab],
  );
  const tabCounts = useMemo(() => {
    const counts: Record<InspectorTab, number> = {
      seo: 0,
      performance: 0,
      code: 0,
    };
    for (const issue of issues) counts[issue.tab] += 1;
    return counts;
  }, [issues]);
  function isSelected(issue: InspectorIssue) {
    const key = issue.occurrenceKey ?? issue.id;
    return selectedKeys?.has(key) ?? localSelected.has(key);
  }
  function toggleIssue(issue: InspectorIssue) {
    const key = issue.occurrenceKey ?? issue.id;
    if (onToggleSelect) {
      onToggleSelect(issue);
      return;
    }
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  return (
    <div className="font-sans text-white">
      
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        
        <SummaryPill
          label="Critical Issues"
          count={summary.critical}
          tone="red"
        />
        <SummaryPill label="High Priority" count={summary.high} tone="amber" />
        <SummaryPill
          label="Medium / Low"
          count={summary.mediumLow}
          tone="slate"
        />
        <SummaryPill
          label="Passed Checks"
          count={summary.passed}
          tone="emerald"
        />
      </div>
      <div className="mb-6 flex gap-2 border-b border-white/[0.08] text-sm">
        
        {(Object.keys(TAB_LABELS) as InspectorTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-2 pb-3 font-medium transition ${activeTab === tab ? "border-indigo-500 text-bip-accent" : "border-transparent text-white/50 hover:text-white/75"}`}
          >
            
            {TAB_LABELS[tab]}
            <span className="ml-1.5 text-xs text-white/50">
              ({tabCounts[tab]})
            </span>
          </button>
        ))}
      </div>
      <div className="divide-y divide-slate-800/60 rounded-xl border border-white/[0.08] bg-bip-card/40">
        
        {filteredIssues.length === 0 ? (
          <div className="flex items-center gap-3 p-6 text-sm text-white/50">
            
            <CheckCircle2 className="shrink-0 text-bip-accent" size={18} /> No
            open issues in this category.
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const Icon = TAB_ICONS[issue.tab];
            const badge = PRIORITY_BADGE[issue.priority];
            const selected = isSelected(issue);
            return (
              <div
                key={issue.id}
                className="group flex items-center justify-between p-4 transition hover:bg-bip-card/20"
              >
                
                <div className="flex min-w-0 items-start gap-4">
                  
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleIssue(issue)}
                    className="mt-0.5 rounded border-white/[0.08] bg-bip-card text-bip-accent focus:ring-0"
                  />
                  <Icon
                    className={
                      issue.priority === "critical"
                        ? "shrink-0 text-red-400"
                        : issue.priority === "high"
                          ? "shrink-0 text-amber-400"
                          : "shrink-0 text-white/50"
                    }
                    size={18}
                  />
                  <div className="min-w-0">
                    
                    <p className="text-sm font-medium text-white/75">
                      {issue.title}
                    </p>
                    {issue.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-white/50">
                        
                        {issue.description}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">
                      
                      {issue.source}
                    </p>
                  </div>
                </div>
                <span
                  className={`ml-3 shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}
                >
                  
                  {badge.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
function SummaryPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "red" | "amber" | "slate" | "emerald";
}) {
  const styles = {
    red: {
      wrap: "bg-red-500/10 border-red-500/20",
      label: "text-red-400",
      count: "text-red-400 bg-red-500/20",
    },
    amber: {
      wrap: "bg-amber-500/10 border-amber-500/20",
      label: "text-amber-400",
      count: "text-amber-400 bg-amber-500/20",
    },
    slate: {
      wrap: "bg-bip-card border-white/[0.08]",
      label: "text-white/50",
      count: "text-white/75 bg-slate-700",
    },
    emerald: {
      wrap: "bg-emerald-500/10 border-emerald-500/20",
      label: "text-bip-accent",
      count: "text-bip-accent bg-emerald-500/20",
    },
  }[tone];
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-3 ${styles.wrap}`}
    >
      
      <span className={`text-xs font-medium ${styles.label}`}>
        {label}
      </span>
      <span
        className={`rounded-md px-2.5 py-0.5 text-lg font-bold ${styles.count}`}
      >
        
        {count}
      </span>
    </div>
  );
}
