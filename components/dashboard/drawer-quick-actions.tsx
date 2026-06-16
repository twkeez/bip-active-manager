"use client";
import { Loader2 } from "lucide-react";
import type { ReportingActionItem } from "@/lib/reporting/types";
type DrawerQuickActionsProps = {
  action: ReportingActionItem | null;
  onResolve: () => void;
  resolving?: boolean;
  resolveLabel: string;
};
export default function DrawerQuickActions({
  action,
  onResolve,
  resolving = false,
  resolveLabel,
}: DrawerQuickActionsProps) {
  if (!action) return null;
  const priorityLabel =
    action.priority === "high"
      ? "High priority"
      : action.priority === "medium"
        ? "Medium"
        : "Low";
  return (
    <section className="border-b border-white/[0.08] bg-bip-card px-5 py-3">
      
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
        
        Quick Actions
      </p>
      <div className="mt-2 rounded-lg border border-white/[0.08] bg-bip-page p-3">
        
        <div className="flex items-start justify-between gap-3">
          
          <div className="min-w-0 flex-1">
            
            <p className="text-xs font-medium text-red-600">
              {priorityLabel}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              
              {action.title}
            </p>
            <p className="mt-1 text-xs text-white/75">{action.detail}</p>
          </div>
          <button
            type="button"
            onClick={onResolve}
            disabled={resolving}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-bip-card px-3 py-2 text-xs font-semibold text-white hover:bg-bip-card disabled:opacity-60"
          >
            
            {resolving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {resolveLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
