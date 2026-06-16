"use client";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ClientProjectPhase } from "@/lib/types/client";
type Props = {
  phases: ClientProjectPhase[];
  saving: boolean;
  onAddPhase: (title: string) => Promise<void>;
  onUpdatePhase: (
    phaseId: number,
    patch: Partial<Pick<ClientProjectPhase, "title" | "notes" | "status">>,
  ) => Promise<void>;
  onReorderPhase: (phaseId: number, direction: "up" | "down") => Promise<void>;
  onDeletePhase: (phaseId: number) => Promise<void>;
};
export default function ProjectPhasesEditor({
  phases,
  saving,
  onAddPhase,
  onUpdatePhase,
  onReorderPhase,
  onDeletePhase,
}: Props) {
  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  return (
    <div className="space-y-3">
      
      <div className="flex gap-2">
        
        <input
          value={newPhaseTitle}
          onChange={(event) => setNewPhaseTitle(event.target.value)}
          placeholder="New phase title"
          className="flex-1 rounded-md border border-white/10 bg-bip-card px-2 py-1.5"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            const title = newPhaseTitle.trim();
            if (!title) return;
            void onAddPhase(title).then(() => setNewPhaseTitle(""));
          }}
          className="rounded-md bg-bip-card/10 px-3 py-1.5 text-xs hover:bg-bip-card/15 disabled:opacity-60"
        >
          
          Add
        </button>
      </div>
      <ul className="space-y-2">
        
        {phases.map((phase, index) => (
          <li
            key={phase.id}
            className="space-y-2 rounded-lg border border-white/10 bg-bip-page/60 px-3 py-2"
          >
            
            <div className="flex items-start gap-2">
              
              <div className="flex flex-col gap-0.5">
                
                <button
                  type="button"
                  disabled={index === 0 || saving}
                  onClick={() => void onReorderPhase(phase.id, "up")}
                  className="rounded p-0.5 text-white/50 hover:bg-bip-card/10 hover:text-white/75 disabled:opacity-30"
                  aria-label="Move phase up"
                >
                  
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === phases.length - 1 || saving}
                  onClick={() => void onReorderPhase(phase.id, "down")}
                  className="rounded p-0.5 text-white/50 hover:bg-bip-card/10 hover:text-white/75 disabled:opacity-30"
                  aria-label="Move phase down"
                >
                  
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                defaultValue={phase.title}
                onBlur={(event) => {
                  const title = event.target.value.trim();
                  if (title && title !== phase.title) {
                    void onUpdatePhase(phase.id, { title });
                  }
                }}
                className="flex-1 rounded border border-white/10 bg-bip-card px-2 py-1 text-sm font-medium"
              />
              <select
                value={phase.status}
                onChange={(event) =>
                  void onUpdatePhase(phase.id, {
                    status: event.target.value as ClientProjectPhase["status"],
                  })
                }
                className="rounded border border-white/10 bg-bip-card px-1.5 py-1 text-xs"
              >
                
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
              <button
                type="button"
                onClick={() => void onDeletePhase(phase.id)}
                className="text-white/50 hover:text-red-300"
                aria-label="Delete phase"
              >
                
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              defaultValue={phase.notes ?? ""}
              placeholder="Phase notes"
              rows={2}
              onBlur={(event) => {
                const notes = event.target.value.trim();
                if (notes !== (phase.notes ?? "")) {
                  void onUpdatePhase(phase.id, { notes: notes || null });
                }
              }}
              className="w-full rounded border border-white/10 bg-bip-card px-2 py-1 text-xs text-white/75"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
