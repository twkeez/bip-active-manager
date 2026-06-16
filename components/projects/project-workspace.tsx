"use client";
import { Copy, ExternalLink, Loader2, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProjectBoard from "@/components/projects/project-board";
import ProjectHealthStrip from "@/components/projects/project-health-strip";
import ProjectPhasesEditor from "@/components/projects/project-phases-editor";
import ProjectTaskList from "@/components/projects/project-task-list";
import ProjectResources from "@/components/projects/project-resources";
import ProjectTimeline from "@/components/projects/project-timeline";
import { computeProjectHealth } from "@/lib/projects/health";
import {
  INTERNAL_PROJECT_CLIENT_LABEL,
  projectClientLabel,
} from "@/lib/projects/shared";
import type {
  ClientProjectArtifact,
  ClientProjectPhase,
  ClientProjectPlanJson,
  ClientProjectStatus,
  ClientProjectWithMeta,
  PlanApplyPreview,
  TaskClientOption,
} from "@/lib/types/client";
import type { UserTaskWithSource } from "@/lib/tasks/shared";
type Props = {
  projectId: number;
  tasks: UserTaskWithSource[];
  clientOptions: TaskClientOption[];
  onProjectUpdated: (project: ClientProjectWithMeta) => void;
  onProjectsListRefresh: () => Promise<void>;
  onTasksRefresh: () => Promise<void>;
  onPatchTask: (
    taskId: number,
    patch: Record<string, unknown>,
  ) => Promise<void>;
  onOpenTaskDetail: (task: UserTaskWithSource) => void;
  onProjectDeleted: () => void;
  onError: (message: string | null) => void;
};
const STATUS_OPTIONS: ClientProjectStatus[] = [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
];
type WorkspaceTab =
  | "overview"
  | "phases"
  | "tasks"
  | "resources"
  | "ai"
  | "history";
type TaskViewMode = "list" | "board";
function groupTasksForProject(
  project: ClientProjectWithMeta,
  tasks: UserTaskWithSource[],
): {
  phases: Array<{
    phase: ClientProjectPhase;
    tasks: UserTaskWithSource[];
    doneCount: number;
    totalCount: number;
  }>;
  unassigned: UserTaskWithSource[];
} {
  const projectTasks = tasks.filter((task) => task.project_id === project.id);
  const byPhase = new Map<number, UserTaskWithSource[]>();
  const unassigned: UserTaskWithSource[] = [];
  for (const task of projectTasks) {
    if (task.phase_id == null) {
      unassigned.push(task);
      continue;
    }
    const bucket = byPhase.get(task.phase_id) ?? [];
    bucket.push(task);
    byPhase.set(task.phase_id, bucket);
  }
  return {
    phases: project.phases.map((phase) => {
      const phaseTasks = byPhase.get(phase.id) ?? [];
      const doneCount = phaseTasks.filter(
        (task) => task.status === "done",
      ).length;
      return {
        phase,
        tasks: phaseTasks,
        doneCount,
        totalCount: phaseTasks.length,
      };
    }),
    unassigned,
  };
}
export default function ProjectWorkspace({
  projectId,
  tasks,
  clientOptions,
  onProjectUpdated,
  onProjectsListRefresh,
  onTasksRefresh,
  onPatchTask,
  onOpenTaskDetail,
  onProjectDeleted,
  onError,
}: Props) {
  const [project, setProject] = useState<ClientProjectWithMeta | null>(null);
  const [artifacts, setArtifacts] = useState<ClientProjectArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [taskView, setTaskView] = useState<TaskViewMode>("list");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [lastPlanArtifactId, setLastPlanArtifactId] = useState<number | null>(
    null,
  );
  const [applyingPlan, setApplyingPlan] = useState(false);
  const [planPreview, setPlanPreview] = useState<PlanApplyPreview | null>(null);
  const [planMode, setPlanMode] = useState<"merge" | "replace">("merge");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPhaseId, setNewTaskPhaseId] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteBody, setNewNoteBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editObjective, setEditObjective] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<ClientProjectStatus>("active");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const onProjectUpdatedRef = useRef(onProjectUpdated);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onProjectUpdatedRef.current = onProjectUpdated;
    onErrorRef.current = onError;
  }, [onProjectUpdated, onError]);
  const loadProject = useCallback(async () => {
    setLoading(true);
    onErrorRef.current(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        error?: string;
        project?: ClientProjectWithMeta;
        artifacts?: ClientProjectArtifact[];
      };
      if (!response.ok || !payload.project) {
        throw new Error(payload.error ?? "Failed to load project");
      }
      setProject(payload.project);
      setArtifacts(payload.artifacts ?? []);
      setEditName(payload.project.name);
      setEditObjective(payload.project.objective ?? "");
      setEditDescription(payload.project.description ?? "");
      setEditStatus(payload.project.status);
      setEditStartDate(payload.project.target_start_date ?? "");
      setEditEndDate(payload.project.target_end_date ?? "");
      setEditClientId(
        payload.project.client_id == null
          ? "internal"
          : String(payload.project.client_id),
      );
      const latestPlan = (payload.artifacts ?? []).find(
        (artifact) => artifact.artifact_type === "plan",
      );
      if (latestPlan) setLastPlanArtifactId(latestPlan.id);
      onProjectUpdatedRef.current(payload.project);
    } catch (error) {
      onErrorRef.current(
        error instanceof Error ? error.message : "Failed to load project",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    void loadProject();
  }, [projectId, loadProject]);
  const groupedTasks = useMemo(
    () =>
      project
        ? groupTasksForProject(project, tasks)
        : { phases: [], unassigned: [] },
    [project, tasks],
  );
  const health = useMemo(() => {
    if (!project) return null;
    const projectTasks = tasks.filter((task) => task.project_id === project.id);
    return computeProjectHealth(project, projectTasks);
  }, [project, tasks]);
  async function patchProject(patch: Record<string, unknown>) {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = (await response.json()) as {
      error?: string;
      project?: ClientProjectWithMeta;
    };
    if (!response.ok || !payload.project) {
      throw new Error(payload.error ?? "Failed to update project");
    }
    setProject(payload.project);
    onProjectUpdated(payload.project);
    await onProjectsListRefresh();
  }
  async function handleSaveOverview() {
    setSaving(true);
    onError(null);
    try {
      await patchProject({
        name: editName.trim(),
        objective: editObjective.trim() || null,
        description: editDescription.trim() || null,
        status: editStatus,
        clientId: editClientId === "internal" ? null : Number(editClientId),
        targetStartDate: editStartDate.trim() || null,
        targetEndDate: editEndDate.trim() || null,
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }
  async function handleDeleteProject() {
    if (
      !window.confirm(
        "Delete this project? Linked tasks will remain but lose project association.",
      )
    ) {
      return;
    }
    onError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Failed to delete project");
      onProjectDeleted();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to delete project",
      );
    }
  }
  async function handleAddPhase(title: string) {
    setSaving(true);
    onError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/phases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to add phase");
      await loadProject();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to add phase");
    } finally {
      setSaving(false);
    }
  }
  async function handleUpdatePhase(
    phaseId: number,
    patch: Partial<Pick<ClientProjectPhase, "title" | "notes" | "status">>,
  ) {
    onError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Failed to update phase");
      await loadProject();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to update phase",
      );
    }
  }
  async function handleReorderPhase(phaseId: number, direction: "up" | "down") {
    if (!project) return;
    const index = project.phases.findIndex((phase) => phase.id === phaseId);
    if (index < 0) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= project.phases.length) return;
    const current = project.phases[index]!;
    const swap = project.phases[swapIndex]!;
    setSaving(true);
    onError(null);
    try {
      await Promise.all([
        fetch(`/api/projects/${projectId}/phases/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: swap.sort_order }),
        }),
        fetch(`/api/projects/${projectId}/phases/${swap.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: current.sort_order }),
        }),
      ]);
      await loadProject();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to reorder phase",
      );
    } finally {
      setSaving(false);
    }
  }
  async function handleDeletePhase(phaseId: number) {
    onError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Failed to delete phase");
      await loadProject();
      await onTasksRefresh();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to delete phase",
      );
    }
  }
  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title || !project) return;
    setSaving(true);
    onError(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          clientId: project.client_id,
          projectId: project.id,
          phaseId: newTaskPhaseId ? Number(newTaskPhaseId) : null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Failed to create task");
      setNewTaskTitle("");
      await onTasksRefresh();
      await loadProject();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  }
  async function handleMoveTask(taskId: number, phaseId: number | null) {
    onError(null);
    try {
      await onPatchTask(taskId, { phaseId });
      await loadProject();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to move task");
    }
  }
  async function runAi(action: "brainstorm" | "plan" | "weekly-status") {
    setAiLoading(action);
    onError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/ai/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "weekly-status"
            ? {}
            : { prompt: aiPrompt.trim() || undefined },
        ),
      });
      const payload = (await response.json()) as {
        error?: string;
        artifact?: ClientProjectArtifact;
      };
      if (!response.ok) throw new Error(payload.error ?? `AI ${action} failed`);
      if (payload.artifact?.artifact_type === "plan") {
        setLastPlanArtifactId(payload.artifact.id);
        setPlanPreview(null);
      }
      await loadProject();
      setTab("history");
    } catch (error) {
      onError(error instanceof Error ? error.message : `AI ${action} failed`);
    } finally {
      setAiLoading(null);
    }
  }
  async function handlePreviewPlan() {
    if (!lastPlanArtifactId) {
      onError("Generate a plan first.");
      return;
    }
    onError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/tasks/from-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifactId: lastPlanArtifactId,
            preview: true,
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        preview?: PlanApplyPreview;
      };
      if (!response.ok || !payload.preview) {
        throw new Error(payload.error ?? "Failed to preview plan");
      }
      setPlanPreview(payload.preview);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to preview plan",
      );
    }
  }
  async function handleApplyPlan() {
    if (!lastPlanArtifactId) {
      onError("Generate a plan first.");
      return;
    }
    setApplyingPlan(true);
    onError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/tasks/from-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifactId: lastPlanArtifactId,
            mode: planMode,
          }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        tasksCreated?: number;
        tasksUpdated?: number;
        phasesCreated?: number;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Failed to apply plan");
      await onTasksRefresh();
      await loadProject();
      setPlanPreview(null);
      setStatusMessage(
        `Applied plan: ${payload.phasesCreated ?? 0} new phases, ${payload.tasksCreated ?? 0} tasks created, ${payload.tasksUpdated ?? 0} updated.`,
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to apply plan");
    } finally {
      setApplyingPlan(false);
    }
  }
  async function handleAddNote() {
    const title = newNoteTitle.trim();
    const body = newNoteBody.trim();
    if (!title || !body) {
      onError("Note title and body are required.");
      return;
    }
    setSaving(true);
    onError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/artifacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactType: "note",
          title,
          contentMarkdown: body,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to save note");
      setNewNoteTitle("");
      setNewNoteBody("");
      await loadProject();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }
  if (loading && !project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/40">
        
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading project…
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/40">
        
        Select a project from the list.
      </div>
    );
  }
  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "phases", label: "Phases" },
    { id: "tasks", label: "Tasks" },
    { id: "resources", label: "Resources" },
    { id: "ai", label: "AI" },
    { id: "history", label: "History" },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      
      <div className="mb-3 border-b border-white/10 pb-3">
        
        <div className="flex flex-wrap items-start justify-between gap-2">
          
          <div>
            
            <h2 className="text-lg font-semibold text-white">
              {project.name}
            </h2>
            <p className="text-sm text-white/40">
              {projectClientLabel(project.client)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            
            {project.client_id != null ? (
              <Link
                href={`/reports/${project.client_id}`}
                className="inline-flex items-center gap-1 rounded-md bg-bip-card/10 px-2.5 py-1.5 text-xs text-white hover:bg-bip-card/15"
              >
                
                Client report <ExternalLink className="h-3 w-3" />
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void handleDeleteProject()}
              className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
            >
              
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        </div>
        {health ? <ProjectHealthStrip health={health} /> : null}
        <ProjectTimeline
          phases={project.phases}
          targetStartDate={project.target_start_date}
          targetEndDate={project.target_end_date}
        />
        <div className="mt-3 flex flex-wrap gap-1">
          
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${tab === item.id ? "bg-bip-card/15 text-white" : "text-white/40 hover:bg-bip-card/5 hover:text-white/75"}`}
            >
              
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {statusMessage ? (
        <p className="mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          
          {statusMessage}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm text-white/75">
        
        {tab === "overview" ? (
          <div className="space-y-3">
            
            <label className="block">
              
              <span className="text-xs text-white/40">Name</span>
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-bip-card px-2 py-1.5"
              />
            </label>
            <label className="block">
              
              <span className="text-xs text-white/40">Objective</span>
              <textarea
                value={editObjective}
                onChange={(event) => setEditObjective(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-white/10 bg-bip-card px-2 py-1.5"
              />
            </label>
            <label className="block">
              
              <span className="text-xs text-white/40">Description</span>
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-white/10 bg-bip-card px-2 py-1.5"
              />
            </label>
            <label className="block">
              
              <span className="text-xs text-white/40">Client</span>
              <select
                value={editClientId}
                onChange={(event) => setEditClientId(event.target.value)}
                className="mt-1 block w-full max-w-xs rounded-md border border-white/10 bg-bip-card px-2 py-1.5"
              >
                
                <option value="internal">
                  {INTERNAL_PROJECT_CLIENT_LABEL}
                </option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    
                    {client.account_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              
              <label className="block">
                
                <span className="text-xs text-white/40">Status</span>
                <select
                  value={editStatus}
                  onChange={(event) =>
                    setEditStatus(event.target.value as ClientProjectStatus)
                  }
                  className="mt-1 block rounded-md border border-white/10 bg-bip-card px-2 py-1.5"
                >
                  
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                
                <span className="text-xs text-white/40">Target start</span>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(event) => setEditStartDate(event.target.value)}
                  className="mt-1 block rounded-md border border-white/10 bg-bip-card px-2 py-1.5"
                />
              </label>
              <label className="block">
                
                <span className="text-xs text-white/40">Target end</span>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(event) => setEditEndDate(event.target.value)}
                  className="mt-1 block rounded-md border border-white/10 bg-bip-card px-2 py-1.5"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveOverview()}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-60"
            >
              
              {saving ? "Saving…" : "Save overview"}
            </button>
          </div>
        ) : null}
        {tab === "phases" ? (
          <ProjectPhasesEditor
            phases={project.phases}
            saving={saving}
            onAddPhase={handleAddPhase}
            onUpdatePhase={handleUpdatePhase}
            onReorderPhase={handleReorderPhase}
            onDeletePhase={handleDeletePhase}
          />
        ) : null}
        {tab === "tasks" ? (
          <div className="space-y-3">
            
            <div className="flex flex-wrap items-center gap-2">
              
              <div className="flex gap-1 rounded-md border border-white/10 p-0.5">
                
                <button
                  type="button"
                  onClick={() => setTaskView("list")}
                  className={`rounded px-2 py-1 text-xs ${taskView === "list" ? "bg-bip-card/15 text-white" : "text-white/40"}`}
                >
                  
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setTaskView("board")}
                  className={`rounded px-2 py-1 text-xs ${taskView === "board" ? "bg-bip-card/15 text-white" : "text-white/40"}`}
                >
                  
                  Board
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              
              <input
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                placeholder="Quick-add task for this project"
                className="min-w-[12rem] flex-1 rounded-md border border-white/10 bg-bip-card px-2 py-1.5"
              />
              <select
                value={newTaskPhaseId}
                onChange={(event) => setNewTaskPhaseId(event.target.value)}
                className="rounded-md border border-white/10 bg-bip-card px-2 py-1.5 text-xs"
              >
                
                <option value="">No phase</option>
                {project.phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    
                    {phase.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleAddTask()}
                className="rounded-md bg-bip-card/10 px-3 py-1.5 text-xs hover:bg-bip-card/15"
              >
                
                Add
              </button>
            </div>
            {taskView === "list" ? (
              <ProjectTaskList
                phases={groupedTasks.phases}
                unassigned={groupedTasks.unassigned}
                onToggleDone={(task) =>
                  void onPatchTask(task.id, {
                    status: task.status === "done" ? "not_started" : "done",
                  }).then(() => loadProject())
                }
                onToggleStar={(task) =>
                  void onPatchTask(task.id, { isStarred: !task.is_starred })
                }
                onDueDateChange={(task, dueDate) =>
                  void onPatchTask(task.id, { dueDate }).then(() =>
                    loadProject(),
                  )
                }
                onOpenDetail={onOpenTaskDetail}
              />
            ) : (
              <ProjectBoard
                phases={groupedTasks.phases}
                unassigned={groupedTasks.unassigned}
                onMoveTask={handleMoveTask}
                onToggleDone={(task) =>
                  void onPatchTask(task.id, {
                    status: task.status === "done" ? "not_started" : "done",
                  }).then(() => loadProject())
                }
                onToggleStar={(task) =>
                  void onPatchTask(task.id, { isStarred: !task.is_starred })
                }
                onDueDateChange={(task, dueDate) =>
                  void onPatchTask(task.id, { dueDate }).then(() =>
                    loadProject(),
                  )
                }
                onOpenDetail={onOpenTaskDetail}
              />
            )}
          </div>
        ) : null}
        {tab === "resources" ? (
          <ProjectResources
            projectId={project.id}
            ownerUserId={project.owner_user_id}
            onError={onError}
          />
        ) : null}
        {tab === "ai" ? (
          <div className="space-y-4">
            
            <label className="block">
              
              <span className="text-xs text-white/40">
                Optional focus (brainstorm / plan)
              </span>
              <textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                rows={2}
                placeholder="e.g. Focus on social hiring ads and landing page"
                className="mt-1 w-full rounded-md border border-white/10 bg-bip-card px-2 py-1.5"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              
              <button
                type="button"
                disabled={Boolean(aiLoading)}
                onClick={() => void runAi("brainstorm")}
                className="inline-flex items-center gap-1 rounded-md bg-violet-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-60"
              >
                
                {aiLoading === "brainstorm" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Brainstorm
              </button>
              <button
                type="button"
                disabled={Boolean(aiLoading)}
                onClick={() => void runAi("plan")}
                className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-60"
              >
                
                {aiLoading === "plan" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate plan
              </button>
              <button
                type="button"
                disabled={Boolean(aiLoading)}
                onClick={() => void runAi("weekly-status")}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-bip-accent disabled:opacity-60"
              >
                
                {aiLoading === "weekly-status" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Weekly status
              </button>
            </div>
            {lastPlanArtifactId ? (
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
                
                <p className="text-xs text-sky-100">
                  
                  Latest plan ready. Preview changes before applying to phases
                  and tasks.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  
                  <select
                    value={planMode}
                    onChange={(event) =>
                      setPlanMode(event.target.value as "merge" | "replace")
                    }
                    className="rounded border border-white/10 bg-bip-card px-2 py-1 text-xs"
                  >
                    
                    <option value="merge">Merge (update existing)</option>
                    <option value="replace">Replace plan tasks</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handlePreviewPlan()}
                    className="rounded-md bg-bip-card/10 px-3 py-1.5 text-xs text-white hover:bg-bip-card/15"
                  >
                    
                    Preview changes
                  </button>
                  <button
                    type="button"
                    disabled={applyingPlan}
                    onClick={() => void handleApplyPlan()}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-60"
                  >
                    
                    {applyingPlan ? "Applying…" : "Apply plan"}
                  </button>
                </div>
                {planPreview ? (
                  <p className="mt-2 text-[11px] text-sky-100">
                    
                    {planPreview.phasesToCreate.length} new phases ·{""}
                    {planPreview.tasksToCreate.length} new tasks ·{""}
                    {planPreview.tasksToUpdate.length} updates ·{""}
                    {planPreview.tasksSkipped} unchanged
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {tab === "history" ? (
          <div className="space-y-4">
            
            <div className="rounded-lg border border-white/10 bg-bip-page/60 p-3">
              
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                
                Add manual note
              </p>
              <input
                value={newNoteTitle}
                onChange={(event) => setNewNoteTitle(event.target.value)}
                placeholder="Note title"
                className="mb-2 w-full rounded-md border border-white/10 bg-bip-card px-2 py-1.5 text-sm"
              />
              <textarea
                value={newNoteBody}
                onChange={(event) => setNewNoteBody(event.target.value)}
                placeholder="Note content (markdown supported)"
                rows={3}
                className="mb-2 w-full rounded-md border border-white/10 bg-bip-card px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleAddNote()}
                className="rounded-md bg-bip-card/10 px-3 py-1.5 text-xs hover:bg-bip-card/15 disabled:opacity-60"
              >
                
                Save note
              </button>
            </div>
            <ul className="space-y-3">
              
              {artifacts.length === 0 ? (
                <li className="text-white/50">
                  No artifacts yet. Run an AI action above.
                </li>
              ) : (
                artifacts.map((artifact) => (
                  <li
                    key={artifact.id}
                    className="rounded-lg border border-white/10 bg-bip-page/60 p-3"
                  >
                    
                    <div className="mb-1 flex items-center justify-between gap-2">
                      
                      <p className="font-medium text-white">
                        {artifact.title}
                      </p>
                      <div className="flex items-center gap-2">
                        
                        {artifact.artifact_type === "weekly_status" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void navigator.clipboard.writeText(
                                artifact.content_markdown,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded bg-bip-card/10 px-2 py-0.5 text-[10px] text-white/75 hover:bg-bip-card/15"
                          >
                            
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        ) : null}
                        <span className="text-[10px] uppercase text-white/50">
                          
                          {artifact.artifact_type}
                        </span>
                      </div>
                    </div>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-sans text-xs text-white/75">
                      
                      {artifact.content_markdown}
                    </pre>
                    {artifact.artifact_type === "plan" &&
                    artifact.content_json &&
                    typeof artifact.content_json === "object" ? (
                      <p className="mt-2 text-[11px] text-white/50">
                        
                        {(artifact.content_json as ClientProjectPlanJson).phases
                          ?.length ?? 0}
                        {""} phases in structured plan
                      </p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
