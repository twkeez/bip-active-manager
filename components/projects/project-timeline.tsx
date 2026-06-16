"use client";
import type { ClientProjectPhase } from "@/lib/types/client";
type Props = {
  phases: ClientProjectPhase[];
  targetStartDate: string | null;
  targetEndDate: string | null;
};
export default function ProjectTimeline({
  phases,
  targetStartDate,
  targetEndDate,
}: Props) {
  if (phases.length === 0 && !targetStartDate && !targetEndDate) {
    return null;
  }
  return (
    <div className="mb-3 rounded-lg border border-white/10 bg-bip-page/60 p-3">
      
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
        
        Timeline
      </p>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
        
        {targetStartDate ? <span>Start {targetStartDate}</span> : null}
        {targetEndDate ? <span>End {targetEndDate}</span> : null}
      </div>
      <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
        
        {phases.map((phase, index) => (
          <div
            key={phase.id}
            className="min-w-[7rem] flex-1 rounded-md border border-white/10 bg-bip-card/80 px-2 py-1.5"
          >
            
            <p className="truncate text-xs font-medium text-white/75">
              {phase.title}
            </p>
            <p className="text-[10px] capitalize text-white/50">
              
              {index + 1}/{phases.length} · {phase.status.replace("_", "")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
