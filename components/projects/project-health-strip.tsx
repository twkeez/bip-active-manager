"use client";
import type { ProjectHealthSummary } from "@/lib/types/client";
type Props = { health: ProjectHealthSummary };
export default function ProjectHealthStrip({ health }: Props) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-bip-border bg-bip-page/60 p-3 text-xs md:grid-cols-4">
      
      <div>
        
        <p className="text-bip-muted">Open tasks</p>
        <p className="text-base font-semibold text-bip-text">
          {health.openTaskCount}
        </p>
      </div>
      <div>
        
        <p className="text-bip-muted">Overdue</p>
        <p
          className={`text-base font-semibold ${health.overdueTaskCount > 0 ? "text-red-300" : "text-bip-text"}`}
        >
          
          {health.overdueTaskCount}
        </p>
      </div>
      <div>
        
        <p className="text-bip-muted">Next due</p>
        <p className="text-base font-semibold text-bip-text">
          
          {health.nextDueDate ?? "—"}
        </p>
      </div>
      <div>
        
        <p className="text-bip-muted">Progress</p>
        <p className="text-base font-semibold text-bip-text">
          
          {health.taskCompletionPercent}%
          {health.daysToTargetEnd != null ? (
            <span className="ml-1 text-[11px] font-normal text-bip-muted">
              
              · {health.daysToTargetEnd}d to target
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
