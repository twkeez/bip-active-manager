"use client";
import { Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  ClientProjectStatus,
  ClientProjectWithMeta,
  TaskClientOption,
} from "@/lib/types/client";
import {
  INTERNAL_PROJECT_CLIENT_LABEL,
  projectClientLabel,
} from "@/lib/projects/shared";
type Props = {
  projects: ClientProjectWithMeta[];
  clientOptions: TaskClientOption[];
  selectedProjectId: number | null;
  onSelectProject: (projectId: number) => void;
  onProjectsChange: (projects: ClientProjectWithMeta[]) => void;
  onError: (message: string | null) => void;
};
const STATUS_LABELS: Record<ClientProjectStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};
function statusBadgeClass(status: ClientProjectStatus) {
  if (status === "active") return "bg-emerald-500/20 text-emerald-200";
  if (status === "paused") return "bg-amber-500/20 text-amber-200";
  if (status === "completed") return "bg-sky-500/20 text-sky-200";
  if (status === "archived") return "bg-zinc-500/20 text-bip-text";
  return "bg-zinc-600/40 text-bip-text";
}
export default function ProjectsPanel({
  projects,
  clientOptions,
  selectedProjectId,
  onSelectProject,
  onProjectsChange,
  onError,
}: Props) {
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientProjectStatus | "">(
    "",
  );
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newObjective, setNewObjective] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const filtered = useMemo(() => {
    return projects.filter((project) => {
      if (clientFilter === "internal") {
        if (project.client_id != null) return false;
      } else if (clientFilter && String(project.client_id) !== clientFilter) {
        return false;
      }
      if (statusFilter && project.status !== statusFilter) return false;
      return true;
    });
  }, [projects, clientFilter, statusFilter]);
  async function handleCreate() {
    const name = newName.trim();
    const isInternal = newClientId === "internal";
    const clientId = isInternal ? null : Number(newClientId);
    if (!isInternal && (!Number.isInteger(clientId) || clientId! <= 0)) {
      onError("Select a client or choose Internal.");
      return;
    }
    if (!name) {
      onError("Project name is required.");
      return;
    }
    setCreating(true);
    onError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          name,
          objective: newObjective.trim() || null,
          description: newDescription.trim() || null,
          targetStartDate: newStartDate.trim() || null,
          targetEndDate: newEndDate.trim() || null,
          status: "active",
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        project?: ClientProjectWithMeta;
      };
      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Failed to create project");
      }
      onProjectsChange([payload.project, ...projects]);
      onSelectProject(payload.project.id);
      setShowCreate(false);
      setNewName("");
      setNewObjective("");
      setNewDescription("");
      setNewStartDate("");
      setNewEndDate("");
      setNewClientId("");
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to create project",
      );
    } finally {
      setCreating(false);
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      
      <div className="mb-3 flex flex-wrap items-center gap-2">
        
        <select
          value={clientFilter}
          onChange={(event) => setClientFilter(event.target.value)}
          className="rounded-md border border-bip-border bg-bip-card/80 px-2 py-1.5 text-xs text-bip-text"
        >
          
          <option value="">All clients</option>
          <option value="internal">{INTERNAL_PROJECT_CLIENT_LABEL}</option>
          {clientOptions.map((client) => (
            <option key={client.id} value={String(client.id)}>
              
              {client.account_name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as ClientProjectStatus | "")
          }
          className="rounded-md border border-bip-border bg-bip-card/80 px-2 py-1.5 text-xs text-bip-text"
        >
          
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as ClientProjectStatus[]).map(
            (status) => (
              <option key={status} value={status}>
                
                {STATUS_LABELS[status]}
              </option>
            ),
          )}
        </select>
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-bip-card/10 px-2.5 py-1.5 text-xs font-medium text-bip-text hover:bg-bip-card/15"
        >
          
          <Plus className="h-3.5 w-3.5" /> New project
        </button>
      </div>
      {showCreate ? (
        <div className="mb-3 rounded-lg border border-bip-border bg-bip-page/70 p-3 text-sm">
          
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bip-muted">
            
            New client project
          </p>
          <div className="space-y-2">
            
            <select
              value={newClientId}
              onChange={(event) => setNewClientId(event.target.value)}
              className="w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text"
            >
              
              <option value="">Select client…</option>
              <option value="internal">{INTERNAL_PROJECT_CLIENT_LABEL}</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={String(client.id)}>
                  
                  {client.account_name}
                </option>
              ))}
            </select>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Hiring Campaign"
              className="w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text"
            />
            <textarea
              value={newObjective}
              onChange={(event) => setNewObjective(event.target.value)}
              placeholder="Objective (roles, channels, timeline…)"
              rows={2}
              className="w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text"
            />
            <textarea
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text"
            />
            <div className="flex gap-2">
              
              <input
                type="date"
                value={newStartDate}
                onChange={(event) => setNewStartDate(event.target.value)}
                className="w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text"
                aria-label="Target start date"
              />
              <input
                type="date"
                value={newEndDate}
                onChange={(event) => setNewEndDate(event.target.value)}
                className="w-full rounded-md border border-bip-border bg-bip-card px-2 py-1.5 text-sm text-bip-text"
                aria-label="Target end date"
              />
            </div>
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-60"
            >
              
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Create
            </button>
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-bip-border px-3 py-6 text-center text-sm text-bip-muted">
            
            No projects yet. Create one to plan a client initiative.
          </p>
        ) : (
          filtered.map((project) => {
            const selected = project.id === selectedProjectId;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(project.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition ${selected ? "border-sky-400/50 bg-sky-500/10" : "border-bip-border bg-bip-page/50 hover:border-bip-border"}`}
              >
                
                <div className="flex items-start justify-between gap-2">
                  
                  <div>
                    
                    <p className="font-medium text-bip-text">
                      {project.name}
                    </p>
                    <p className="text-xs text-bip-muted">
                      {projectClientLabel(project.client)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeClass(project.status)}`}
                  >
                    
                    {STATUS_LABELS[project.status]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-bip-muted">
                  
                  <span>
                    
                    Phases {project.phaseDoneCount}/
                    {project.phaseTotalCount}
                  </span>
                  <span>{project.openTaskCount} open tasks</span>
                  {project.target_end_date ? (
                    <span>Due {project.target_end_date}</span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
