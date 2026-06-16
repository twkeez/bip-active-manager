"use client";
import type { ProjectHealthSummary } from "@/lib/types/client";
type Props = { health: ProjectHealthSummary };
export default function ProjectHealthStrip({ health }: Props) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-bip-page/60 p-3 text-xs md:grid-cols-4">
      
      <div>
        
        <p className="text-white/50">Open tasks</p>
        <p className="text-base font-semibold text-white">
          {health.openTaskCount}
        </p>
      </div>
      <div>
        
        <p className="text-white/50">Overdue</p>
        <p
          className={`text-base font-semibold ${health.overdueTaskCount > 0 ? "text-red-300" : "text-white"}`}
        >
          
          {health.overdueTaskCount}
        </p>
      </div>
      <div>
        
        <p className="text-white/50">Next due</p>
        <p className="text-base font-semibold text-white">
          
          {health.nextDueDate ?? "—"}
        </p>
      </div>
      <div>
        
        <p className="text-white/50">Progress</p>
        <p className="text-base font-semibold text-white">
          
          {health.taskCompletionPercent}%
          {health.daysToTargetEnd != null ? (
            <span className="ml-1 text-[11px] font-normal text-white/50">
              
              · {health.daysToTargetEnd}d to target
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
