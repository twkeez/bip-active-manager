"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, Copy, FolderPlus, Loader2, Mail, MessageCircle, Search, Send, Star, Trash2, UserRound,
} from "lucide-react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { TaskClientOption, UserEmailMessageRow, UserEmailSenderRule, UserTaskAttachment, UserTaskCategory, UserTaskLink, UserTaskPerson, UserTaskPriority, UserTaskSource, UserTaskStatus,
} from "@/lib/types/client";
import type { UserTaskWithSource } from "@/lib/tasks/shared";
import { projectClientLabel } from "@/lib/projects/shared";
import TaskStageBoard, { taskStageLabelSafe } from "@/components/tasks/task-stage-board";
import TaskCategoryBoard from "@/components/tasks/task-category-board";
import { TASK_BOARD_STAGES, type TaskBoardStage } from "@/lib/tasks/stages";
import ProjectsPanel from "@/components/projects/projects-panel";
import ProjectWorkspace from "@/components/projects/project-workspace";
import type { ClientProjectWithMeta } from "@/lib/types/client";
type Props = { initialTasks: UserTaskWithSource[]; initialCategories: UserTaskCategory[]; clientOptions: TaskClientOption[]; initialPeople: UserTaskPerson[]; initialProjects: ClientProjectWithMeta[]; userEmail: string | undefined; initialEmailMessages: UserEmailMessageRow[]; initialEmailRules: UserEmailSenderRule[];
};
type MainView ="tasks" |"projects";
type TaskPayload = { error?: string; task?: UserTaskWithSource };
type CategoryPayload = { error?: string; category?: UserTaskCategory };
type TaskListPayload = { error?: string; tasks?: UserTaskWithSource[]; categories?: UserTaskCategory[]; people?: UserTaskPerson[];
};
type SidebarFolder ="inbox" |"starred" |"today" |"week" |"done";
const PRIORITY_ORDER: Record<UserTaskPriority, number> = { high: 3, medium: 2, low: 1,
};
const STAGE_ORDER: Record<UserTaskStatus, number> = { not_started: 0, in_progress: 1, waiting_on_client: 2, done: 3,
};
function normalize(value: string | null | undefined) {
  return (value ??"").trim();
}
function toNullableInt(value: string) {
  if (!value) return null;
const parsed = Number(value);
return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function formatDate(value: string | null | undefined) {
  if (!value) return"No due date";
const parsed = new Date(`${value}T00:00:00`);
if (Number.isNaN(parsed.getTime())) return"Invalid date";
return parsed.toLocaleDateString();
}
function taskSourceLabel(task: UserTaskWithSource) {
  if (task.source_type ==="basecamp") return"Basecamp";
if (task.source_type ==="email") return"Email";
if (task.source_type ==="plan") return"Plan";
return"Manual";
}
function buildExternalSourceUrl(source: UserTaskSource | null) {
  if (!source?.source_url) return null;
return source.source_url.replace("/api/v1/","/").replace(/\.json(\?.*)?$/,"$1");
}
function isDueThisWeek(dueDate: string | null, todayDate: string) {
  if (!dueDate) return false;
const today = new Date(`${todayDate}T00:00:00`);
const due = new Date(`${dueDate}T00:00:00`);
const days = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
return days >= 0 && days <= 7;
}
function sortTasks(tasks: UserTaskWithSource[]) {
  return [...tasks].sort((left, right) => { if (left.is_starred !== right.is_starred) return left.is_starred ? -1 : 1;
if (left.status ==="done" && right.status !=="done") return 1;
if (left.status !=="done" && right.status ==="done") return -1;
const leftStage = STAGE_ORDER[left.status] ?? 0;
const rightStage = STAGE_ORDER[right.status] ?? 0;
if (leftStage !== rightStage) return leftStage - rightStage;
if (left.priority !== right.priority) {
  return PRIORITY_ORDER[right.priority] - PRIORITY_ORDER[left.priority]; }
const leftDue = left.due_date ? new Date(`${left.due_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
const rightDue = right.due_date ? new Date(`${right.due_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
if (leftDue !== rightDue) return leftDue - rightDue;
return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(); });
}

export default function MyTasksManager({ initialTasks, initialCategories, clientOptions, initialPeople, initialProjects, userEmail, initialEmailMessages, initialEmailRules,
}: Props) {
  const supabase = createSupabaseClient();
const router = useRouter();
const searchParams = useSearchParams();
const dingAudioRef = useRef<HTMLAudioElement | null>(null);
const [tasks, setTasks] = useState<UserTaskWithSource[]>(sortTasks(initialTasks));
const [categories, setCategories] = useState<UserTaskCategory[]>(initialCategories);
const [people, setPeople] = useState<UserTaskPerson[]>(initialPeople);
const [folder, setFolder] = useState<SidebarFolder>("inbox");
const [boardView, setBoardView] = useState<"stage" | "groups">("stage");
const [title, setTitle] = useState("");
const [addingCategory, setAddingCategory] = useState(false);
const [search, setSearch] = useState("");
const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
const [tokenLoading, setTokenLoading] = useState(false);
const [forwardingAddress, setForwardingAddress] = useState("");
const [tokenMessage, setTokenMessage] = useState<string | null>(null);
const [todayDate] = useState(() => new Date().toISOString().slice(0, 10));
const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
const [detailDescription, setDetailDescription] = useState("");
const [detailPriority, setDetailPriority] = useState<UserTaskPriority>("medium");
const [detailStatus, setDetailStatus] = useState<UserTaskStatus>("not_started");
const [detailDueDate, setDetailDueDate] = useState("");
const [detailCategoryId, setDetailCategoryId] = useState("");
const [detailClientId, setDetailClientId] = useState("");
const [detailProjectId, setDetailProjectId] = useState("");
const [detailPhaseId, setDetailPhaseId] = useState("");
const [detailNewCategoryName, setDetailNewCategoryName] = useState("");
const [detailSavingMeta, setDetailSavingMeta] = useState(false);
const [detailSavingDescription, setDetailSavingDescription] = useState(false);
const [detailSelectedPersonIds, setDetailSelectedPersonIds] = useState<number[]>([]);
const [detailLinkLabel, setDetailLinkLabel] = useState("");
const [detailLinkUrl, setDetailLinkUrl] = useState("");
const [detailSavingLink, setDetailSavingLink] = useState(false);
const [detailSavingAssignees, setDetailSavingAssignees] = useState(false);
const [detailUploadingAttachment, setDetailUploadingAttachment] = useState(false);
const [importText, setImportText] = useState("");
const [importing, setImporting] = useState(false);
const [importMessage, setImportMessage] = useState<string | null>(null);
const [aiChatInput, setAiChatInput] = useState("");
const [aiChatMessages, setAiChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
const [aiChatLoading, setAiChatLoading] = useState(false);
const [chatConfirm, setChatConfirm] = useState(false);
const [gmailConnected, setGmailConnected] = useState(false);
const [gmailConnectMeta, setGmailConnectMeta] = useState<string>("");
const [gmailMessages, setGmailMessages] = useState<UserEmailMessageRow[]>(initialEmailMessages);
const [gmailRules, setGmailRules] = useState<UserEmailSenderRule[]>(initialEmailRules);
const [gmailView, setGmailView] = useState<"inbox" |"needs_action" |"high_priority" |"archived" |"deleted" >("inbox");
const [gmailLoading, setGmailLoading] = useState(false);
const [gmailMessageIndex, setGmailMessageIndex] = useState(0);
const [gmailQuery, setGmailQuery] = useState("");
const [mainView, setMainView] = useState<MainView>("tasks");
const [projects, setProjects] = useState<ClientProjectWithMeta[]>(initialProjects);
const [selectedProjectId, setSelectedProjectId] = useState<number | null>( initialProjects[0]?.id ?? null, );
const detailProject = useMemo( () => detailProjectId ? projects.find((project) => project.id === Number(detailProjectId)) ?? null : null, [detailProjectId, projects], );
const detailProjectOptions = useMemo(() => { const clientId = toNullableInt(detailClientId);
if (clientId == null) return projects;
return projects.filter((project) => project.client_id === clientId); }, [detailClientId, projects]);
function syncProjectsUrl(view: MainView, projectId: number | null) {
  const params = new URLSearchParams(searchParams.toString());
if (view ==="projects") { params.set("view","projects");
if (projectId != null) params.set("project", String(projectId)); else params.delete("project"); }
else { params.delete("view"); params.delete("project"); }
const query = params.toString(); router.replace(query ? `/my-tasks?${query}` :"/my-tasks", { scroll: false }); }
function selectProject(projectId: number) {
  setSelectedProjectId(projectId);
setMainView("projects"); syncProjectsUrl("projects", projectId); } useEffect(() => { const view = searchParams.get("view");
const projectParam = searchParams.get("project");
if (view ==="projects") {
  setMainView("projects"); }
if (projectParam) {
  const projectId = Number(projectParam);
if (Number.isInteger(projectId) && projectId > 0) {
  setSelectedProjectId(projectId); } } }, [searchParams]);
async function reloadTasks() {
  const response = await fetch("/api/tasks", { cache:"no-store" });
const payload = (await response.json()) as TaskListPayload;
if (!response.ok) throw new Error(payload.error ??"Failed to reload tasks");
if (payload.tasks) setTasks(sortTasks(payload.tasks));
if (payload.categories) setCategories(payload.categories);
if (payload.people) setPeople(payload.people); }
async function reloadProjects() {
  const response = await fetch("/api/projects", { cache:"no-store" });
const payload = (await response.json()) as { error?: string; projects?: ClientProjectWithMeta[]; };
if (!response.ok) throw new Error(payload.error ??"Failed to reload projects");
const next = payload.projects ?? [];
setProjects(next);
if (selectedProjectId != null && !next.some((p) => p.id === selectedProjectId)) {
  const fallback = next[0]?.id ?? null;
setSelectedProjectId(fallback);
if (mainView ==="projects") { syncProjectsUrl("projects", fallback); } } }
const handleProjectUpdated = useCallback((project: ClientProjectWithMeta) => { setProjects((prev) => prev.map((item) => (item.id === project.id ? project : item)), ); }, []); useEffect(() => { dingAudioRef.current = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=", ); dingAudioRef.current.volume = 0.35; }, []); useEffect(() => { void (async () => { try { const response = await fetch("/api/gmail/connect-status", { cache:"no-store", });
const payload = (await response.json()) as { connected?: boolean; expiresAt?: string | null; };
if (!response.ok) return;
setGmailConnected(Boolean(payload.connected));
setGmailConnectMeta( payload.connected ? `Connected${ payload.expiresAt ? ` (expires ${new Date(payload.expiresAt).toLocaleString()})` :"" }` :"Not connected", ); }
catch { setGmailConnectMeta("Status unavailable"); } })(); }, []);
const overdueCount = useMemo( () => tasks.filter( (task) => task.status !=="done" && Boolean(task.due_date) && String(task.due_date) < todayDate, ).length, [tasks, todayDate], );
const visibleTasks = useMemo(() => { const query = normalize(search).toLowerCase();
return sortTasks( tasks.filter((task) => { if (folder ==="inbox" && task.status ==="done") return false;
if (folder ==="starred" && !task.is_starred) return false;
if (folder ==="today" && task.due_date !== todayDate) return false;
if (folder ==="week" && !isDueThisWeek(task.due_date, todayDate)) return false;
if (folder ==="done" && task.status !=="done") return false;
if (categoryFilter != null && task.category_id !== categoryFilter) return false;
if (!query) return true;
return ( task.title.toLowerCase().includes(query) || normalize(task.description).toLowerCase().includes(query) || normalize(task.notes).toLowerCase().includes(query) ); }), ); }, [tasks, folder, todayDate, search, categoryFilter]);
const detailTask = useMemo( () => detailTaskId == null ? null : tasks.find((task) => task.id === detailTaskId) ?? null, [detailTaskId, tasks], );
const groupedVisibleTasks = useMemo(() => { const grouped = new Map<string, UserTaskWithSource[]>(); for (const task of visibleTasks) {
  const key = folder ==="done" ?"Done" : taskStageLabelSafe(task.status);
const current = grouped.get(key) ?? []; current.push(task); grouped.set(key, current); }
const stageOrder = [...TASK_BOARD_STAGES.map((stage) => stage.label),"Done"];
return [...grouped.entries()].sort((a, b) => { const leftIndex = stageOrder.indexOf(a[0]);
const rightIndex = stageOrder.indexOf(b[0]);
if (leftIndex === -1 && rightIndex === -1) return a[0].localeCompare(b[0]);
if (leftIndex === -1) return 1;
if (rightIndex === -1) return -1;
return leftIndex - rightIndex; }); }, [visibleTasks, folder]);
const filteredGmailMessages = useMemo(() => { const query = normalize(gmailQuery).toLowerCase();
return gmailMessages.filter((message) => { if (gmailView ==="high_priority" && !message.is_high_priority) return false;
if (gmailView ==="needs_action" && !message.needs_action) return false;
if (gmailView ==="archived" && message.triage_status !=="archived") return false;
if (gmailView ==="deleted" && message.triage_status !=="deleted") return false;
if (gmailView ==="inbox" && message.triage_status ==="deleted") return false;
if (!query) return true;
return [message.subject, message.snippet, message.from_email, message.from_name] .filter(Boolean) .some((value) => String(value).toLowerCase().includes(query)); }); }, [gmailMessages, gmailQuery, gmailView]);
const selectedGmailMessage = filteredGmailMessages[gmailMessageIndex] ?? null;
async function reloadTaskState() {
  const response = await fetch("/api/tasks", { cache:"no-store" });
const payload = (await response.json()) as TaskListPayload;
if (!response.ok || !payload.tasks) { throw new Error(payload.error ??"Failed to reload tasks"); } setTasks(sortTasks(payload.tasks));
if (payload.categories) setCategories(payload.categories);
if (payload.people) setPeople(payload.people); }
async function patchTask(taskId: number, patch: Record<string, unknown>) {
  const response = await fetch(`/api/tasks/${taskId}`, { method:"PATCH", headers: {"Content-Type":"application/json" }, body: JSON.stringify(patch), });
const payload = (await response.json()) as TaskPayload;
if (!response.ok || !payload.task) { throw new Error(payload.error ??"Failed to update task"); } setTasks((prev) => sortTasks(prev.map((task) => (task.id === taskId ? payload.task! : task)))); }
async function handleToggleDone(task: UserTaskWithSource) {
  const nextStatus: UserTaskStatus = task.status ==="done" ?"not_started" :"done";
await patchTask(task.id, { status: nextStatus });
if (nextStatus ==="done") {
  try { await dingAudioRef.current?.play(); }
catch {
  // ignore autoplay failures
}
}
}
async function handleMoveTaskStage(taskId: number, status: TaskBoardStage) {
  const task = tasks.find((row) => row.id === taskId);
if (!task || task.status === status) return;
try { await patchTask(taskId, { status }); }
catch (moveError) {
  setError(moveError instanceof Error ? moveError.message :"Failed to move task."); } }
async function handleToggleStar(task: UserTaskWithSource) {
  await patchTask(task.id, { isStarred: !task.is_starred }); }
async function handleDeleteTask(taskId: number) {
  setError(null);
const response = await fetch(`/api/tasks/${taskId}`, { method:"DELETE" });
const payload = (await response.json()) as { error?: string };
if (!response.ok) {
  setError(payload.error ??"Failed to delete task");
return; } setTasks((prev) => prev.filter((task) => task.id !== taskId)); }
async function handleCreateTask() {
  if (!normalize(title)) return;
setSaving(true);
setError(null);
try { const response = await fetch("/api/tasks", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ title: normalize(title), notes: null, description: null, priority:"medium", dueDate: null, categoryId: null, clientId: null, isStarred: false, }), });
const payload = (await response.json()) as TaskPayload;
if (!response.ok || !payload.task) { throw new Error(payload.error ??"Failed to create task"); } setTasks((prev) => sortTasks([payload.task!, ...prev]));
setTitle(""); }
catch (createError) {
  setError(createError instanceof Error ? createError.message :"Failed to create task."); }
finally { setSaving(false); } }
async function handleAddCategory() {
  if (!detailTask) return;
const name = normalize(detailNewCategoryName);
if (!name) return;
setAddingCategory(true);
try { const response = await fetch("/api/tasks/categories", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ name }), });
const payload = (await response.json()) as CategoryPayload;
if (!response.ok || !payload.category) { throw new Error(payload.error ??"Failed to add category"); } setCategories((prev) => { if (prev.some((item) => item.id === payload.category!.id)) return prev;
return [...prev, payload.category!].sort((a, b) => a.name.localeCompare(b.name)); });
if (detailTask) {
  setDetailCategoryId(String(payload.category.id));
setDetailNewCategoryName(""); } }
catch (categoryError) {
  setError(categoryError instanceof Error ? categoryError.message :"Failed to add category."); }
finally { setAddingCategory(false); } }
function openDetail(task: UserTaskWithSource) {
  setDetailTaskId(task.id);
setDetailDescription(task.description ??"");
setDetailPriority(task.priority);
setDetailStatus(task.status);
setDetailDueDate(task.due_date ??"");
setDetailCategoryId(task.category_id == null ?"" : String(task.category_id));
setDetailClientId(task.client_id == null ?"" : String(task.client_id));
setDetailProjectId(task.project_id == null ?"" : String(task.project_id));
setDetailPhaseId(task.phase_id == null ?"" : String(task.phase_id));
setDetailNewCategoryName("");
setDetailSelectedPersonIds(task.assignees.map((person) => person.id));
setDetailLinkLabel("");
setDetailLinkUrl("");
setAiChatMessages([]);
setAiChatInput("");
setChatConfirm(false); }
function closeDetail() {
  setDetailTaskId(null);
setDetailDescription("");
setDetailPriority("medium");
setDetailStatus("not_started");
setDetailDueDate("");
setDetailCategoryId("");
setDetailClientId("");
setDetailProjectId("");
setDetailPhaseId("");
setDetailNewCategoryName("");
setDetailSelectedPersonIds([]);
setDetailLinkLabel("");
setDetailLinkUrl(""); }
async function handleSaveDetailMeta() {
  if (!detailTask) return;
setDetailSavingMeta(true);
try { await patchTask(detailTask.id, { priority: detailPriority, status: detailStatus, dueDate: detailDueDate || null, categoryId: toNullableInt(detailCategoryId), clientId: toNullableInt(detailClientId), projectId: toNullableInt(detailProjectId), phaseId: toNullableInt(detailPhaseId), }); }
catch (detailError) {
  setError(detailError instanceof Error ? detailError.message :"Failed to save details."); }
finally { setDetailSavingMeta(false); } }
async function handleSaveDetailDescription() {
  if (!detailTask) return;
setDetailSavingDescription(true);
try { await patchTask(detailTask.id, { description: normalize(detailDescription) || null }); }
catch (detailError) {
  setError(detailError instanceof Error ? detailError.message :"Failed to save description."); }
finally { setDetailSavingDescription(false); } }
async function handleSaveAssignees() {
  if (!detailTask) return;
setDetailSavingAssignees(true);
try { const response = await fetch(`/api/tasks/${detailTask.id}/assignees`, { method:"PUT", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ personIds: detailSelectedPersonIds }), });
const payload = (await response.json()) as { error?: string; assignees?: UserTaskPerson[] };
if (!response.ok) throw new Error(payload.error ??"Failed to save assignees");
setTasks((prev) => sortTasks( prev.map((task) => task.id === detailTask.id ? { ...task, assignees: payload.assignees ?? [] } : task, ), ), ); }
catch (assignError) {
  setError(assignError instanceof Error ? assignError.message :"Failed to save assignees."); }
finally { setDetailSavingAssignees(false); } }
async function handleAddLink() {
  if (!detailTask) return;
setDetailSavingLink(true);
try { const response = await fetch(`/api/tasks/${detailTask.id}/links`, { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ label: normalize(detailLinkLabel), url: normalize(detailLinkUrl) }), });
const payload = (await response.json()) as { error?: string; link?: UserTaskLink };
if (!response.ok || !payload.link) throw new Error(payload.error ??"Failed to add link");
setTasks((prev) => sortTasks( prev.map((task) => task.id === detailTask.id ? { ...task, links: [payload.link!, ...task.links] } : task, ), ), );
setDetailLinkLabel("");
setDetailLinkUrl(""); }
catch (linkError) {
  setError(linkError instanceof Error ? linkError.message :"Failed to add link."); }
finally { setDetailSavingLink(false); } }
async function handleDeleteLink(linkId: number) {
  if (!detailTask) return;
const response = await fetch(`/api/tasks/${detailTask.id}/links/${linkId}`, { method:"DELETE" });
const payload = (await response.json()) as { error?: string };
if (!response.ok) {
  setError(payload.error ??"Failed to remove link");
return; } setTasks((prev) => sortTasks( prev.map((task) => task.id === detailTask.id ? { ...task, links: task.links.filter((link) => link.id !== linkId) } : task, ), ), ); }
async function handleUploadAttachment(file: File) {
  if (!detailTask) return;
setDetailUploadingAttachment(true);
try { const safeName = file.name.replace(/[^\w.\-]+/g,"_");
const uniqueSuffix = `${file.lastModified}-${file.size}`;
const path = `${detailTask.owner_user_id}/${detailTask.id}/${uniqueSuffix}-${safeName}`;
const { data: uploadData, error: uploadError } = await supabase.storage .from("task-documents") .upload(path, file, { upsert: false, contentType: file.type ||"application/octet-stream", });
if (uploadError || !uploadData) throw new Error(uploadError?.message ??"Upload failed");
const response = await fetch(`/api/tasks/${detailTask.id}/attachments`, { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ storagePath: uploadData.path, fileName: file.name, mimeType: file.type || null, sizeBytes: file.size, }), });
const payload = (await response.json()) as { error?: string; attachment?: UserTaskAttachment; };
if (!response.ok || !payload.attachment) { throw new Error(payload.error ??"Failed to save attachment metadata"); } setTasks((prev) => sortTasks( prev.map((task) => task.id === detailTask.id ? { ...task, attachments: [payload.attachment!, ...task.attachments] } : task, ), ), ); }
catch (attachmentError) {
  setError( attachmentError instanceof Error ? attachmentError.message :"Failed to upload attachment.", ); }
finally { setDetailUploadingAttachment(false); } }
async function handleDeleteAttachment(attachmentId: number) {
  if (!detailTask) return;
const response = await fetch( `/api/tasks/${detailTask.id}/attachments/${attachmentId}`, { method:"DELETE" }, );
const payload = (await response.json()) as { error?: string };
if (!response.ok) {
  setError(payload.error ??"Failed to remove attachment");
return; } setTasks((prev) => sortTasks( prev.map((task) => task.id === detailTask.id ? { ...task, attachments: task.attachments.filter((item) => item.id !== attachmentId), } : task, ), ), ); }
async function handleOpenAttachment(path: string) {
  const { data, error: signedUrlError } = await supabase.storage .from("task-documents") .createSignedUrl(path, 60);
if (signedUrlError || !data?.signedUrl) {
  setError(signedUrlError?.message ??"Failed to open attachment");
return; } window.open(data.signedUrl,"_blank","noopener,noreferrer"); }
async function handleImportLegacyTasks() {
  if (!normalize(importText)) return;
setImporting(true);
setImportMessage(null);
try { const response = await fetch("/api/tasks/import", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ rawText: importText }), });
const payload = (await response.json()) as { error?: string; imported?: number; attempted?: number; errors?: string[]; };
if (!response.ok) throw new Error(payload.error ??"Import failed");
await reloadTaskState();
setImportMessage( `Imported ${payload.imported ?? 0} of ${payload.attempted ?? 0}${ payload.errors?.length ? ` (${payload.errors.length} failed)` :"" }.`, ); }
catch (importError) {
  setError(importError instanceof Error ? importError.message :"Failed to import tasks."); }
finally { setImporting(false); } }
async function handleAiChat(confirmed = false) {
  if (!detailTask || !aiChatInput.trim() || aiChatLoading) return;
  if (aiChatMessages.length === 0 && !confirmed) {
    setChatConfirm(true);
    return;
  }
  setChatConfirm(false);
  const message = aiChatInput.trim();
  setAiChatInput("");
  const history = aiChatMessages;
  const nextMessages = [...history, { role: "user" as const, content: message }];
  setAiChatMessages(nextMessages);
  setAiChatLoading(true);
  try {
    const res = await fetch(`/api/tasks/${detailTask.id}/ai-assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
    const data = (await res.json()) as { error?: string; reply?: string };
    if (!res.ok) throw new Error(data.error ?? "AI request failed");
    setAiChatMessages([...nextMessages, { role: "assistant" as const, content: data.reply ?? "" }]);
  } catch (e) {
    setError(e instanceof Error ? e.message : "AI chat failed.");
    setAiChatMessages(history);
  } finally {
    setAiChatLoading(false);
  }
}
async function handleMoveCategoryTask(taskId: number, categoryId: number | null) {
  try { await patchTask(taskId, { categoryId }); }
  catch (e) { setError(e instanceof Error ? e.message : "Failed to move task."); }
}
async function handleCreateCategoryStandalone(name: string) {
  const response = await fetch("/api/tasks/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
  const payload = (await response.json()) as CategoryPayload;
  if (!response.ok || !payload.category) throw new Error(payload.error ?? "Failed to add category");
  setCategories((prev) => {
    if (prev.some((item) => item.id === payload.category!.id)) return prev;
    return [...prev, payload.category!].sort((a, b) => a.name.localeCompare(b.name));
  });
}
async function handleLoadForwardingAddress(rotate = false) {
  setTokenLoading(true);
setTokenMessage(null);
try { const response = await fetch("/api/tasks/inbox-token", { method: rotate ?"POST" :"GET", });
const payload = (await response.json()) as { error?: string; forwardingAddress?: string; };
if (!response.ok || !payload.forwardingAddress) { throw new Error(payload.error ??"Failed to load forwarding address"); } setForwardingAddress(payload.forwardingAddress);
if (rotate) setTokenMessage("Forwarding address rotated."); }
catch (loadError) {
  setTokenMessage( loadError instanceof Error ? loadError.message :"Failed to load forwarding address.", ); }
finally { setTokenLoading(false); } }
async function reloadGmailMessages( view: typeof gmailView = gmailView, preserveIndex = false, ) {
  const response = await fetch( `/api/gmail/messages?view=${encodeURIComponent(view)}&limit=200`, { cache:"no-store", }, );
const payload = (await response.json()) as { error?: string; rows?: UserEmailMessageRow[]; };
if (!response.ok) { throw new Error(payload.error ??"Failed to load Gmail messages"); } setGmailMessages(payload.rows ?? []);
if (!preserveIndex) setGmailMessageIndex(0); }
async function handleSyncGmail() {
  setGmailLoading(true);
setError(null);
try { const response = await fetch("/api/gmail/sync", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({}), });
const payload = (await response.json()) as { error?: string; synced?: number; };
if (!response.ok) throw new Error(payload.error ??"Failed to sync Gmail");
await reloadGmailMessages();
setGmailConnectMeta(`Synced ${payload.synced ?? 0} messages`); }
catch (syncError) {
  setError(syncError instanceof Error ? syncError.message :"Failed to sync Gmail."); }
finally { setGmailLoading(false); } }
async function handleUpsertGmailRule( sender: string, ruleType:"blacklist" |"always_high_priority", ) {
  const response = await fetch("/api/gmail/rules", { method:"PUT", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ sender, ruleType, isActive: true }), });
const payload = (await response.json()) as { error?: string; rules?: UserEmailSenderRule[]; };
if (!response.ok) throw new Error(payload.error ??"Failed to save Gmail rule");
setGmailRules(payload.rules ?? []); }
async function handleGmailAction( action: |"archive" |"trash" |"mark_read" |"mark_unread" |"star" |"unstar" |"create_task" |"blacklist_sender" |"set_high_priority", value?: boolean, ) {
  if (!selectedGmailMessage) return;
setError(null);
const response = await fetch("/api/gmail/actions", { method:"POST", headers: {"Content-Type":"application/json" }, body: JSON.stringify({ messageId: selectedGmailMessage.id, action, value, }), });
const payload = (await response.json()) as { error?: string; task?: UserTaskWithSource; };
if (!response.ok) throw new Error(payload.error ??"Failed Gmail action");
if (payload.task) {
  setTasks((prev) => sortTasks([payload.task!, ...prev.filter((task) => task.id !== payload.task!.id)]), ); } await reloadGmailMessages(gmailView, true); } useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (!selectedGmailMessage) return;
const target = event.target as HTMLElement | null;
const tagName = target?.tagName?.toLowerCase();
if (tagName ==="input" || tagName ==="textarea" || target?.isContentEditable) return;
const key = event.key.toLowerCase();
if (key ==="a") { event.preventDefault(); void handleGmailAction("archive"); }
else if (key ==="d") { event.preventDefault(); void handleGmailAction("trash"); }
else if (key ==="t") { event.preventDefault(); void handleGmailAction("create_task"); }
else if (key ==="h") { event.preventDefault(); void handleGmailAction("set_high_priority", !selectedGmailMessage.is_high_priority); }
else if (key ==="b") { event.preventDefault();
const sender = selectedGmailMessage.from_email;
if (sender) {
  void handleUpsertGmailRule(sender,"blacklist").then(() => handleGmailAction("blacklist_sender"), ); } }
else if (key ==="j") { event.preventDefault();
setGmailMessageIndex((index) => Math.min(index + 1, Math.max(0, filteredGmailMessages.length - 1))); }
else if (key ==="k") { event.preventDefault();
setGmailMessageIndex((index) => Math.max(0, index - 1)); } }; window.addEventListener("keydown", onKeyDown);
return () => window.removeEventListener("keydown", onKeyDown); }, [ selectedGmailMessage, filteredGmailMessages.length, gmailView, handleGmailAction, handleUpsertGmailRule, ]);
const folders = [ { id:"inbox" as const, label:"Board", count: tasks.filter((t) => t.status !=="done").length }, { id:"starred" as const, label:"Starred", count: tasks.filter((t) => t.is_starred).length }, { id:"today" as const, label:"Today", count: tasks.filter((t) => t.due_date === todayDate).length }, { id:"week" as const, label:"Week", count: tasks.filter((t) => isDueThisWeek(t.due_date, todayDate)).length }, { id:"done" as const, label:"Done", count: tasks.filter((t) => t.status ==="done").length }, ];
return ( <div className="min-h-screen bg-bip-page text-bip-text font-sans" > <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-3 px-4 py-4 md:px-6"> <aside className="w-56 shrink-0 rounded-xl border border-bip-border bg-bip-card p-3 text-bip-text shadow-none"> <div className="mb-3 flex items-center justify-between"> <div> <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-bip-muted"> Wunderlist </p> <p className="text-xs text-bip-muted">{userEmail ??"Signed in"}</p> </div> <a href="/dashboard" className="rounded-md border border-bip-border p-1 hover:bg-bip-fill"> <ArrowLeft className="h-3.5 w-3.5" /> </a> </div> <nav className="space-y-1"> {folders.map((item) => ( <button key={item.id}

type="button" onClick={() => setFolder(item.id)} className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] transition ${ folder === item.id ?"bg-bip-fill text-bip-text shadow-inner" :"text-bip-text hover:bg-bip-fill hover:text-bip-text" }`} > <span className={`tracking-[0.01em] ${folder === item.id ?"font-semibold" :"font-medium"}`} > {item.label} </span> <span className="text-[11px] text-bip-muted">{item.count}</span> </button> ))} </nav> <div className="mt-3 rounded-md border border-red-500/80 bg-[#e0382f] px-2 py-1.5 text-xs font-semibold text-bip-text shadow-none"> Overdue: {overdueCount} </div> <div className="mt-3 space-y-2 border-t border-bip-border pt-3"> <p className="text-[11px] uppercase tracking-wide text-bip-muted">Email capture</p> {!forwardingAddress ? ( <button type="button" onClick={() => void handleLoadForwardingAddress(false)} className="w-full rounded-md border border-bip-border bg-bip-card/60 px-2 py-1.5 text-xs hover:bg-bip-fill" > {tokenLoading ?"Loading..." :"Load forwarding address"} </button> ) : ( <button type="button" onClick={() => void navigator.clipboard.writeText(forwardingAddress)} className="flex w-full items-center gap-1 rounded-md border border-bip-border bg-bip-card/60 px-2 py-1.5 text-left text-xs hover:bg-bip-fill" > <Copy className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{forwardingAddress}</span> </button> )} <button type="button" onClick={() => void handleLoadForwardingAddress(true)} className="w-full rounded-md border border-bip-border bg-bip-card/60 px-2 py-1.5 text-xs hover:bg-bip-fill" > Rotate </button> {tokenMessage && <p className="text-[11px] text-bip-muted">{tokenMessage}</p>} </div> </aside> <main className="min-w-0 flex-1 rounded-xl border border-bip-border bg-bip-card p-3 shadow-none"> <div className="mb-3 flex gap-1 rounded-lg border border-bip-border bg-bip-card p-1"> <button type="button" onClick={() => { setMainView("tasks"); syncProjectsUrl("tasks", null); }} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${ mainView ==="tasks" ?"bg-bip-card text-bip-text shadow-none" :"text-bip-muted hover:text-bip-text" }`} > Tasks </button> <button type="button" onClick={() => { setMainView("projects"); syncProjectsUrl("projects", selectedProjectId); }} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${ mainView ==="projects" ?"bg-bip-card text-bip-text shadow-none" :"text-bip-muted hover:text-bip-text" }`} > Projects </button> </div> {mainView ==="projects" ? ( <section className="flex min-h-[70vh] gap-3 rounded-xl border border-bip-border bg-bip-card p-3 shadow-none"> <div className="w-full max-w-sm shrink-0 border-r border-bip-border pr-3"> <ProjectsPanel projects={projects} clientOptions={clientOptions} selectedProjectId={selectedProjectId} onSelectProject={selectProject} onProjectsChange={setProjects} onError={setError} /> </div> <div className="min-w-0 flex-1"> {selectedProjectId != null ? ( <ProjectWorkspace projectId={selectedProjectId} tasks={tasks} clientOptions={clientOptions} onProjectUpdated={handleProjectUpdated} onProjectsListRefresh={reloadProjects} onTasksRefresh={reloadTasks} onPatchTask={patchTask} onOpenTaskDetail={(task) => { setMainView("tasks"); syncProjectsUrl("tasks", null); openDetail(task); }} onProjectDeleted={async () => { const response = await fetch("/api/projects", { cache:"no-store" });
const payload = (await response.json()) as { projects?: ClientProjectWithMeta[]; };
const next = payload.projects ?? [];
setProjects(next);
const fallback = next[0]?.id ?? null;
setSelectedProjectId(fallback); syncProjectsUrl("projects", fallback); }} onError={setError} /> ) : ( <p className="flex h-full items-center justify-center text-sm text-bip-muted"> Select or create a project to get started. </p> )} </div> </section> ) : null} {mainView ==="tasks" ? ( <section className="rounded-xl border border-bip-border bg-bip-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.18)]"> <div className="mb-2 flex items-center justify-between gap-2"> <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-bip-text"> {folders.find((item) => item.id === folder)?.label ??"Board"} </h1> <div className="flex items-center gap-1.5"> <label className="relative"> <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bip-muted" /> <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" className="rounded-md border border-bip-border bg-bip-card/78 py-1.5 pl-7 pr-2 text-[13px] text-bip-text" /> </label> <select value={categoryFilter == null ?"" : String(categoryFilter)} onChange={(event) => setCategoryFilter(event.target.value ? Number(event.target.value) : null) } className="rounded-md border border-bip-border bg-bip-card/78 px-2 py-1.5 text-[13px] text-bip-text" > <option value="">All categories</option> {categories.map((category) => ( <option key={category.id} value={category.id}> {category.name} </option> ))} </select>  </div> </div>
 <div className="mb-3 rounded-lg border border-bip-border bg-bip-card/70 p-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.16)]"> <div className="grid gap-2 md:grid-cols-[1fr_auto]"> <input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key ==="Enter") { event.preventDefault(); void handleCreateTask(); } }} placeholder="Quick add task... press Enter" className="rounded-md border border-bip-border bg-bip-card/85 px-3 py-2 text-[13px] text-bip-text placeholder:text-bip-muted" /> <button type="button" onClick={() => void handleCreateTask()} disabled={saving} className="rounded-md border border-bip-accent bg-bip-accent px-3 py-2 text-[13px] font-medium text-bip-page shadow-none disabled:opacity-60" > {saving ?"Adding..." :"Add"} </button> </div> <p className="mt-2 text-[11px] text-bip-muted"> Add quickly here, then click the task to assign client, label, due date, and other details in the popout. </p> </div> <div className="overflow-hidden rounded-lg border border-bip-border shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"> {visibleTasks.length === 0 ? ( <p className="px-4 py-12 text-center text-sm text-bip-muted"> No tasks in this folder yet. </p> ) : folder ==="inbox" ? ( <div className="p-3"> <div className="mb-3 flex items-center justify-between gap-2"> <p className="text-[11px] text-bip-muted"> {boardView === "stage" ? "Drag between stages to update status." : "Drag tasks into a group to label them."} </p> <div className="flex overflow-hidden rounded-md border border-bip-border text-[12px]"> <button type="button" onClick={() => setBoardView("stage")} className={`px-2.5 py-1 transition ${boardView === "stage" ? "bg-bip-fill text-bip-text" : "text-bip-muted hover:text-bip-text"}`}>Stage</button> <button type="button" onClick={() => setBoardView("groups")} className={`border-l border-bip-border px-2.5 py-1 transition ${boardView === "groups" ? "bg-bip-fill text-bip-text" : "text-bip-muted hover:text-bip-text"}`}>Groups</button> </div> </div> {boardView === "stage" ? ( <TaskStageBoard tasks={visibleTasks} onMoveTask={(taskId, status) => void handleMoveTaskStage(taskId, status)} onToggleDone={(task) => void handleToggleDone(task)} onToggleStar={(task) => void handleToggleStar(task)} onOpenDetail={openDetail} onDeleteTask={(taskId) => void handleDeleteTask(taskId)} formatDate={formatDate} taskSourceLabel={taskSourceLabel} buildExternalSourceUrl={buildExternalSourceUrl} /> ) : ( <TaskCategoryBoard tasks={visibleTasks} categories={categories} onMoveCategory={(taskId, categoryId) => void handleMoveCategoryTask(taskId, categoryId)} onAddCategory={handleCreateCategoryStandalone} onToggleDone={(task) => void handleToggleDone(task)} onToggleStar={(task) => void handleToggleStar(task)} onOpenDetail={openDetail} onDeleteTask={(taskId) => void handleDeleteTask(taskId)} formatDate={formatDate} taskSourceLabel={taskSourceLabel} buildExternalSourceUrl={buildExternalSourceUrl} /> )} </div> ) : ( <div> {groupedVisibleTasks.map(([groupName, groupTasks]) => ( <section key={groupName}> <div className="border-b border-bip-border bg-bip-page px-3 py-1.5"> <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bip-text"> {groupName} ({groupTasks.length}) </h3> </div> <ul> {groupTasks.map((task) => { const sourceUrl = buildExternalSourceUrl(task.source);
return ( <li key={task.id} className={`flex items-start gap-2.5 border-b border-bip-border bg-bip-card px-3 py-2 transition-colors duration-150 hover:bg-bip-fill ${ task.is_starred ?"bg-amber-500/10" :"" }`} > <button type="button" onClick={() => void handleToggleDone(task)} className={`mt-0.5 inline-flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${ task.status ==="done" ?"border-emerald-500 bg-emerald-500 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]" :"border-bip-border bg-bip-card text-transparent hover:border-emerald-500" }`} aria-label={task.status ==="done" ?"Mark not done" :"Mark done"} > <Check className="h-3 w-3" /> </button> <button type="button" onClick={() => openDetail(task)} className="min-w-0 flex-1 text-left" > <p className={`truncate text-[14px] font-medium text-bip-text transition-all duration-200 ${ task.status ==="done" ?"text-bip-muted line-through decoration-bip-muted" :"" }`} > {task.title} </p> <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-bip-muted"> <span className="rounded-full border border-bip-border px-2 py-0.5"> {taskStageLabelSafe(task.status)} </span> <span className="inline-flex items-center gap-1"> <CalendarClock className="h-3 w-3" /> {formatDate(task.due_date)} </span> <span className="rounded-full border border-bip-border px-2 py-0.5"> {task.priority.toUpperCase()} </span> {task.category?.name && ( <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-violet-300"> {task.category.name} </span> )} {task.client && ( <span className="inline-flex items-center gap-1 rounded-full border border-bip-border px-2 py-0.5"> <UserRound className="h-2.5 w-2.5" /> {task.client.account_name} </span> )} <span className="rounded-full border border-bip-border px-2 py-0.5"> {taskSourceLabel(task)} </span> </div> {sourceUrl && ( <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[10px] text-bip-muted underline" onClick={(event) => event.stopPropagation()} > Open source </a> )} </button> <button type="button" onClick={() => void handleToggleStar(task)} className={`mt-0.5 rounded p-1 transition-colors ${ task.is_starred ?"text-[#ff6a2f]" :"text-bip-text hover:text-orange-400" }`} aria-label="Toggle star" > <Star className={`h-3.5 w-3.5 ${task.is_starred ?"fill-current" :""}`} /> </button> <button type="button" onClick={() => void handleDeleteTask(task.id)} className="mt-0.5 rounded p-1 text-bip-text transition-colors hover:text-red-500" aria-label="Delete task" > <Trash2 className="h-3.5 w-3.5" /> </button> </li> ); })} </ul> </section> ))} </div> )} </div> <div className="mt-4 rounded-lg border border-bip-border bg-bip-card/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"> <div className="mb-3 flex flex-wrap items-center justify-between gap-2"> <p className="text-xs font-medium uppercase tracking-wide text-bip-muted"> Gmail triage </p> <div className="flex items-center gap-1.5"> <button type="button" onClick={() => { window.location.href ="/api/gmail/oauth/start"; }} className="rounded-md border border-bip-border bg-bip-page px-2 py-1 text-xs text-bip-text hover:bg-bip-fill" > {gmailConnected ?"Reconnect Gmail" :"Connect Gmail"} </button> <button type="button" onClick={() => void handleSyncGmail()} disabled={!gmailConnected || gmailLoading} className="rounded-md border border-bip-border bg-bip-page px-2 py-1 text-xs text-bip-text hover:bg-bip-fill disabled:opacity-60" > {gmailLoading ?"Syncing..." :"Sync inbox"} </button> </div> </div> <p className="mb-2 text-[11px] text-bip-muted">{gmailConnectMeta ||"Not connected"}</p> <div className="mb-2 flex flex-wrap items-center gap-1.5"> <input value={gmailQuery} onChange={(event) => setGmailQuery(event.target.value)} placeholder="Search mail..." className="rounded border border-bip-border bg-bip-card/85 px-2 py-1 text-xs text-bip-text" /> {( [ ["inbox","Inbox"], ["needs_action","Needs action"], ["high_priority","High priority"], ["archived","Archived"], ["deleted","Deleted"], ] as const ).map(([value, label]) => ( <button key={value} type="button" onClick={() => { setGmailView(value); void reloadGmailMessages(value); }} className={`rounded border px-2 py-1 text-[11px] ${ gmailView === value ?"border-bip-border bg-bip-fill text-bip-text" :"border-bip-border bg-bip-card/85 text-bip-text hover:bg-bip-fill" }`} > {label} </button> ))} </div> <div className="grid gap-2 lg:grid-cols-[1fr_1.2fr]"> <div className="max-h-64 overflow-auto rounded border border-bip-border bg-bip-card/85"> {filteredGmailMessages.map((message, index) => ( <button key={message.id} type="button" onClick={() => setGmailMessageIndex(index)} className={`block w-full border-b border-bip-border px-2 py-1.5 text-left text-xs hover:bg-bip-page ${ index === gmailMessageIndex ?"bg-bip-accent/10" :"" }`} > <p className="truncate font-medium text-bip-text"> {message.subject ||"(no subject)"} </p> <p className="truncate text-bip-muted"> {message.from_name || message.from_email ||"Unknown sender"} </p> </button> ))} {filteredGmailMessages.length === 0 && ( <p className="px-3 py-6 text-center text-xs text-bip-muted"> No messages in this view. </p> )} </div> <div className="rounded border border-bip-border bg-bip-card/85 p-2"> {!selectedGmailMessage ? ( <p className="text-xs text-bip-muted">Select a message to triage.</p> ) : ( <> <p className="text-xs font-semibold text-bip-text"> {selectedGmailMessage.subject ||"(no subject)"} </p> <p className="mt-1 text-[11px] text-bip-muted"> From:{""} {selectedGmailMessage.from_name || selectedGmailMessage.from_email ||"Unknown"} </p> <p className="mt-1 text-[11px] text-bip-muted"> {selectedGmailMessage.internal_date ? new Date(selectedGmailMessage.internal_date).toLocaleString() :"No date"} </p> <p className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-xs text-bip-text"> {selectedGmailMessage.body_text || selectedGmailMessage.snippet ||"(empty message)"} </p> <div className="mt-2 flex flex-wrap gap-1.5"> <button type="button" onClick={() => void handleGmailAction("archive")} className="rounded border px-2 py-1 text-[11px] hover:bg-bip-page">Archive (A)</button> <button type="button" onClick={() => void handleGmailAction("trash")} className="rounded border px-2 py-1 text-[11px] hover:bg-bip-page">Delete (D)</button> <button type="button" onClick={() => void handleGmailAction("create_task")} className="rounded border px-2 py-1 text-[11px] hover:bg-bip-page">To task (T)</button> <button type="button" onClick={() => void handleGmailAction(selectedGmailMessage.is_read ?"mark_unread" :"mark_read")} className="rounded border px-2 py-1 text-[11px] hover:bg-bip-page">{selectedGmailMessage.is_read ?"Unread" :"Read"}</button> <button type="button" onClick={() => void handleGmailAction(selectedGmailMessage.is_starred ?"unstar" :"star")} className="rounded border px-2 py-1 text-[11px] hover:bg-bip-page">{selectedGmailMessage.is_starred ?"Unstar" :"Star"}</button> <button type="button" onClick={() => void handleGmailAction("set_high_priority", !selectedGmailMessage.is_high_priority)} className="rounded border px-2 py-1 text-[11px] hover:bg-bip-page">{selectedGmailMessage.is_high_priority ?"Unmark high" :"High priority (H)"}</button> <button type="button" onClick={() => { const sender = selectedGmailMessage.from_email;
if (!sender) return; void handleUpsertGmailRule(sender,"blacklist").then(() => handleGmailAction("blacklist_sender")); }} className="rounded border px-2 py-1 text-[11px] hover:bg-bip-page" > Blacklist (B) </button> <button type="button" onClick={() => { const sender = selectedGmailMessage.from_email;
if (!sender) return; void handleUpsertGmailRule(sender,"always_high_priority"); }} className="rounded border px-2 py-1 text-[11px] hover:bg-bip-page" > Always high sender </button> </div> <p className="mt-2 text-[11px] text-bip-muted"> Shortcuts: J/K navigate, A archive, D delete, T task, B blacklist, H high priority. </p> </> )} </div> </div> {gmailRules.length > 0 && ( <p className="mt-2 text-[11px] text-bip-muted"> Active sender rules:{""} {gmailRules .slice(0, 6) .map((rule) => `${rule.sender} (${rule.rule_type})`) .join(",")} </p> )} </div> <div className="mt-4 rounded-lg border border-bip-border bg-bip-card/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"> <p className="text-xs font-medium uppercase tracking-wide text-bip-muted"> Import legacy table </p> <textarea value={importText} onChange={(event) => setImportText(event.target.value)} className="mt-2 min-h-24 w-full rounded border border-bip-border bg-bip-card/85 px-2 py-1.5 font-mono text-xs text-bip-text" placeholder="Paste tab-delimited rows with header..." /> <div className="mt-2 flex items-center gap-2"> <button type="button" onClick={() => void handleImportLegacyTasks()} disabled={importing} className="rounded-md border border-bip-border bg-bip-page px-3 py-1.5 text-sm text-bip-text hover:bg-bip-fill" > {importing ?"Importing..." :"Import tasks"} </button> {importMessage && <span className="text-xs text-bip-muted">{importMessage}</span>} </div> </div> </section> ) : null} {error && ( <p className="mt-3 rounded-md border border-bip-danger/30 bg-bip-danger/10 px-3 py-2 text-sm text-bip-danger"> {error} </p> )} </main> </div> {detailTask && ( <> <button type="button" className="fixed inset-0 z-40 bg-black/35" onClick={closeDetail} aria-label="Close task details" /> <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-bip-border bg-bip-card p-5 shadow-2xl transition-transform"> <div className="flex items-start justify-between gap-2"> <div> <p className="text-xs uppercase tracking-wide text-bip-muted">Task detail</p> <h2 className="text-base font-semibold text-bip-text">{detailTask.title}</h2> </div> <button type="button" onClick={closeDetail} className="rounded-md border border-bip-border px-2 py-1 text-xs hover:bg-bip-fill" > Close </button> </div> <section className="mt-4 space-y-2"> <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">Description</p> <textarea value={detailDescription} onChange={(event) => setDetailDescription(event.target.value)} className="min-h-28 w-full rounded-lg border border-bip-border px-3 py-2 text-sm text-bip-text" /> <button type="button" onClick={() => void handleSaveDetailDescription()} disabled={detailSavingDescription} className="rounded-md border border-bip-border bg-bip-card px-3 py-1.5 text-xs hover:bg-bip-fill" > {detailSavingDescription ?"Saving..." :"Save description"} </button> </section> <section className="mt-6 space-y-2"> <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">Task settings</p> <div className="grid grid-cols-2 gap-2"> <select value={detailStatus} onChange={(event) => setDetailStatus(event.target.value as UserTaskStatus)} className="rounded border border-bip-border px-2 py-1.5 text-xs" > <option value="not_started">Not Started</option> <option value="in_progress">In Progress</option> <option value="waiting_on_client">Waiting on Client</option> <option value="done">Done</option> </select> <select value={detailPriority} onChange={(event) => setDetailPriority(event.target.value as UserTaskPriority)} className="rounded border border-bip-border px-2 py-1.5 text-xs" > <option value="high">High priority</option> <option value="medium">Medium priority</option> <option value="low">Low priority</option> </select> <input type="date" value={detailDueDate} onChange={(event) => setDetailDueDate(event.target.value)} className="rounded border border-bip-border px-2 py-1.5 text-xs" /> <select value={detailCategoryId} onChange={(event) => setDetailCategoryId(event.target.value)} className="rounded border border-bip-border px-2 py-1.5 text-xs" > <option value="">Label (category)</option> {categories.map((category) => ( <option key={category.id} value={category.id}> {category.name} </option> ))} </select> <select value={detailClientId} onChange={(event) => { setDetailClientId(event.target.value);
setDetailProjectId("");
setDetailPhaseId(""); }} className="rounded border border-bip-border px-2 py-1.5 text-xs" > <option value="">Client (optional)</option> {clientOptions.map((client) => ( <option key={client.id} value={client.id}> {client.account_name} </option> ))} </select> <select value={detailProjectId} onChange={(event) => { setDetailProjectId(event.target.value);
setDetailPhaseId(""); }} className="rounded border border-bip-border px-2 py-1.5 text-xs" > <option value="">Project (optional)</option> {detailProjectOptions.map((project) => ( <option key={project.id} value={project.id}> {project.name} · {projectClientLabel(project.client)} </option> ))} </select> <select value={detailPhaseId} onChange={(event) => setDetailPhaseId(event.target.value)} disabled={!detailProject} className="rounded border border-bip-border px-2 py-1.5 text-xs disabled:opacity-50" > <option value="">Phase (optional)</option> {(detailProject?.phases ?? []).map((phase) => ( <option key={phase.id} value={phase.id}> {phase.title} </option> ))} </select> </div> <div className="flex items-center gap-2"> <input value={detailNewCategoryName} onChange={(event) => setDetailNewCategoryName(event.target.value)} placeholder="Add new label" className="flex-1 rounded border border-bip-border px-2 py-1.5 text-xs" /> <button type="button" onClick={() => void handleAddCategory()} disabled={addingCategory} className="inline-flex items-center gap-1 rounded border border-bip-border px-2 py-1.5 text-xs hover:bg-bip-fill" > {addingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />} Add label </button> </div> <button type="button" onClick={() => void handleSaveDetailMeta()} disabled={detailSavingMeta} className="rounded-md border border-bip-border bg-bip-card px-3 py-1.5 text-xs hover:bg-bip-fill" > {detailSavingMeta ?"Saving..." :"Save settings"} </button> </section> <section className="mt-6 space-y-2"> <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">Assignees</p> <div className="grid grid-cols-2 gap-2"> {people.map((person) => ( <label key={person.id} className="inline-flex items-center gap-2 rounded border border-bip-border px-2 py-1.5 text-xs" > <input type="checkbox" checked={detailSelectedPersonIds.includes(person.id)} onChange={(event) => setDetailSelectedPersonIds((prev) => event.target.checked ? [...new Set([...prev, person.id])] : prev.filter((id) => id !== person.id), ) } /> {person.name} </label> ))} </div> <button type="button" onClick={() => void handleSaveAssignees()} disabled={detailSavingAssignees} className="rounded-md border border-bip-border bg-bip-card px-3 py-1.5 text-xs hover:bg-bip-fill" > {detailSavingAssignees ?"Saving..." :"Save assignees"} </button> </section> <section className="mt-6 space-y-2"> <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">Links</p> <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"> <input value={detailLinkLabel} onChange={(event) => setDetailLinkLabel(event.target.value)} placeholder="Label" className="rounded border border-bip-border px-2 py-1.5 text-xs" /> <input value={detailLinkUrl} onChange={(event) => setDetailLinkUrl(event.target.value)} placeholder="https://..." className="rounded border border-bip-border px-2 py-1.5 text-xs" /> <button type="button" onClick={() => void handleAddLink()} disabled={detailSavingLink} className="rounded border border-bip-border px-2 py-1.5 text-xs hover:bg-bip-fill" > {detailSavingLink ?"Saving..." :"Add"} </button> </div> <ul className="space-y-1"> {detailTask.links.map((link) => ( <li key={link.id} className="flex items-center justify-between rounded border border-bip-border px-2 py-1.5 text-xs"> <a href={link.url} target="_blank" rel="noopener noreferrer" className="truncate text-bip-text underline" > {link.label} </a> <button type="button" onClick={() => void handleDeleteLink(link.id)} className="text-red-600" > Remove </button> </li> ))} </ul> </section> <section className="mt-6 space-y-2"> <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted">Attachments</p> <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-bip-border px-2 py-1.5 text-xs hover:bg-bip-fill"> {detailUploadingAttachment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Upload file <input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0];
if (file) {
  void handleUploadAttachment(file); event.currentTarget.value =""; } }} /> </label> <ul className="space-y-1"> {detailTask.attachments.map((attachment) => ( <li key={attachment.id} className="flex items-center justify-between rounded border border-bip-border px-2 py-1.5 text-xs"> <span className="truncate">{attachment.file_name}</span> <div className="inline-flex gap-2"> <button type="button" onClick={() => void handleOpenAttachment(attachment.storage_path)} className="underline" > Open </button> <button type="button" onClick={() => void handleDeleteAttachment(attachment.id)} className="text-red-600" > Remove </button> </div> </li> ))} </ul> </section>
<section className="mt-6 space-y-2">
  <p className="text-xs font-semibold uppercase tracking-wide text-bip-muted flex items-center gap-1.5">
    <MessageCircle className="h-3.5 w-3.5" /> Ask AI about this task
  </p>
  <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg border border-bip-border bg-bip-card/50 p-2">
    {aiChatMessages.length === 0 ? (
      <p className="text-[12px] text-bip-muted px-1">Ask Claude anything about this task — next steps, how to approach it, draft an email, think through a blocker...</p>
    ) : (
      aiChatMessages.map((msg, i) => (
        <div key={i} className={`rounded-md px-2.5 py-2 text-[13px] leading-relaxed ${msg.role === "user" ? "bg-bip-accent/15 text-bip-text ml-4" : "bg-bip-fill text-bip-text mr-4"}`}>
          <span className="block text-[10px] font-semibold uppercase tracking-widest mb-1 ${msg.role === 'user' ? 'text-bip-accent/70' : 'text-violet-400'}">{msg.role === "user" ? "You" : "Claude"}</span>
          {msg.content}
        </div>
      ))
    )}
    {aiChatLoading && <div className="flex items-center gap-2 px-2.5 py-2 text-[13px] text-bip-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...</div>}
  </div>
  <div className="flex gap-2">
    <input
      value={aiChatInput}
      onChange={(e) => setAiChatInput(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAiChat(); } }}
      placeholder="Ask about this task..."
      disabled={aiChatLoading}
      className="flex-1 rounded-md border border-bip-border bg-bip-card/85 px-3 py-2 text-[13px] text-bip-text placeholder:text-bip-subtle disabled:opacity-60"
    />
    <button
      type="button"
      onClick={() => void handleAiChat()}
      disabled={aiChatLoading || !aiChatInput.trim()}
      className="inline-flex items-center gap-1 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-[13px] text-violet-300 hover:bg-violet-500/20 disabled:opacity-60 transition"
    >
      <Send className="h-3.5 w-3.5" />
    </button>
  </div>
  {chatConfirm && (
    <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
      <span className="text-[12px] text-amber-300">Uses the Claude AI API (~$0.01 max per message). Send?</span>
      <span className="flex gap-2">
        <button type="button" onClick={() => void handleAiChat(true)} className="text-[12px] font-semibold text-emerald-400 hover:text-emerald-300">Send</button>
        <button type="button" onClick={() => setChatConfirm(false)} className="text-[12px] text-bip-muted hover:text-bip-muted">Cancel</button>
      </span>
    </div>
  )}
  {aiChatMessages.length > 0 && (
    <button type="button" onClick={() => setAiChatMessages([])} className="text-[11px] text-bip-subtle hover:text-bip-muted">Clear conversation</button>
  )}
</section>
</aside> </> )} </div> );
}
