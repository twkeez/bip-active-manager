import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultTaskCategories } from "@/lib/tasks/categories";
import { ensureFixedTaskPeople } from "@/lib/tasks/people";
import type {
  ClientProjectWithMeta,
  TaskClientOption,
  UserTaskAttachment,
  UserTaskAssignee,
  UserTask,
  UserTaskCategory,
  UserTaskLink,
  UserTaskPerson,
  UserTaskSource,
  UserEmailMessageRow,
  UserEmailSenderRule,
} from "@/lib/types/client";
import { joinTasksWithSources } from "@/lib/tasks/shared";
import { batchProjectMeta } from "@/lib/projects/access";
import { getProfile } from "@/lib/auth/profile";
import MyTasksManager from "@/components/tasks/my-tasks-manager";
import SeoAuditsDuePanel from "@/components/dashboard/seo-audits-due-panel";
import { dueStatus } from "@/lib/site-audit/seo-audit-schedule";
import type {
  ClientSeoAuditSchedule,
  ClientSeoAuditScheduleWithClient,
} from "@/lib/site-audit/seo-audit-types";
import { getStrategistRoster } from "@/lib/team/strategist-roster";
export default async function MyTasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const profile = await getProfile(supabase);
  const isAdmin = profile?.role === "admin";
  // Every task, in pages. Capped at 500 by updated time, older open tasks
  // silently dropped off the list once there were more (found 2026-09-28).
  // A failed load shows an error page, never an empty list that looks real.
  const tasksRaw = await fetchAllRows<unknown>(
    (from, to) =>
      supabase
        .from("user_tasks")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    "tasks",
  );
  const tasks = (tasksRaw ?? []) as UserTask[];
  const taskIds = tasks.map((task) => task.id);
  let sources: UserTaskSource[] = [];
  if (taskIds.length > 0) {
    const { data: sourcesRaw } = await supabase
      .from("user_task_sources")
      .select("*")
      .eq("owner_user_id", user.id)
      .in("task_id", taskIds)
      .order("created_at", { ascending: false });
    sources = (sourcesRaw ?? []) as UserTaskSource[];
  }
  let categories: UserTaskCategory[] = [];
  try {
    categories = await ensureDefaultTaskCategories(supabase, user.id);
  } catch {
    categories = [];
  }
  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("id,account_name")
    .order("account_name", { ascending: true })
    .limit(1000);
  const clientOptions = (clientsRaw ?? []) as TaskClientOption[];
  let people: UserTaskPerson[] = [];
  try {
    people = await ensureFixedTaskPeople(supabase, user.id);
  } catch {
    people = [];
  }
  const { data: assigneesRaw } = await supabase
    .from("user_task_assignees")
    .select("*")
    .eq("owner_user_id", user.id);
  const assignees = (assigneesRaw ?? []) as UserTaskAssignee[];
  const { data: linksRaw } = await supabase
    .from("user_task_links")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });
  const links = (linksRaw ?? []) as UserTaskLink[];
  const { data: attachmentsRaw } = await supabase
    .from("user_task_attachments")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });
  const attachments = (attachmentsRaw ?? []) as UserTaskAttachment[];
  const peopleById = new Map<number, UserTaskPerson>(
    people.map((person) => [person.id, person]),
  );
  const assigneesByTask: Record<number, UserTaskPerson[]> = {};
  for (const row of assignees) {
    const person = peopleById.get(row.person_id);
    if (!person) continue;
    if (!assigneesByTask[row.task_id]) assigneesByTask[row.task_id] = [];
    assigneesByTask[row.task_id]!.push(person);
  }
  const linksByTask: Record<number, UserTaskLink[]> = {};
  for (const row of links) {
    if (!linksByTask[row.task_id]) linksByTask[row.task_id] = [];
    linksByTask[row.task_id]!.push(row);
  }
  const attachmentsByTask: Record<number, UserTaskAttachment[]> = {};
  for (const row of attachments) {
    if (!attachmentsByTask[row.task_id]) attachmentsByTask[row.task_id] = [];
    attachmentsByTask[row.task_id]!.push(row);
  }
  const { data: gmailMessagesRaw } = await supabase
    .from("user_email_messages")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("internal_date", { ascending: false, nullsFirst: false })
    .limit(200);
  const gmailMessages = (gmailMessagesRaw ?? []) as UserEmailMessageRow[];
  const { data: gmailRulesRaw } = await supabase
    .from("user_email_sender_rules")
    .select("sender,rule_type,is_active")
    .eq("owner_user_id", user.id)
    .eq("is_active", true);
  const gmailRules = (gmailRulesRaw ?? []) as UserEmailSenderRule[];
  const { data: projectsRaw } = await supabase
    .from("client_projects")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  const projectsBase = (projectsRaw ?? []) as Array<{
    id: number;
    owner_user_id: string;
    client_id: number | null;
    name: string;
    description: string | null;
    objective: string | null;
    status: ClientProjectWithMeta["status"];
    target_start_date: string | null;
    target_end_date: string | null;
    created_at: string;
    updated_at: string;
  }>;
  const initialProjects: ClientProjectWithMeta[] = await (async () => {
    if (!projectsBase.length) return [];
    const { phasesByProject, openTaskCountByProject } = await batchProjectMeta(
      supabase,
      user.id,
      projectsBase.map((project) => project.id),
    );
    return projectsBase.map((project) => {
      const phases = phasesByProject.get(project.id) ?? [];
      const client =
        project.client_id == null
          ? null
          : (clientOptions.find((c) => c.id === project.client_id) ?? {
              id: project.client_id,
              account_name: "Client",
            });
      return {
        ...project,
        client,
        phases,
        phaseDoneCount: phases.filter((p) => p.status === "done").length,
        phaseTotalCount: phases.length,
        openTaskCount: openTaskCountByProject.get(project.id) ?? 0,
      } satisfies ClientProjectWithMeta;
    });
  })();
  // SEO audits due: moved here from the retired Dashboard. Shown only when one
  // is due or overdue, since they are to-dos like the rest of the page.
  const { data: seoAuditRows } = await supabase
    .from("client_seo_audit_schedules")
    .select("*, clients(account_name, marketing_strategist, website)")
    .eq("owner_user_id", user.id);
  const seoAuditSchedules: ClientSeoAuditScheduleWithClient[] = (seoAuditRows ?? []).map((row) => {
    const { clients: c, ...schedule } = row as ClientSeoAuditSchedule & {
      clients: { account_name: string; marketing_strategist: string | null; website: string | null } | null;
    };
    return {
      ...schedule,
      account_name: c?.account_name ?? "Unknown client",
      marketing_strategist: c?.marketing_strategist ?? null,
      website: c?.website ?? null,
    };
  });
  const auditsNeedDoing = seoAuditSchedules.some((schedule) => {
    const status = dueStatus(schedule.next_due_at);
    return status === "due" || status === "overdue";
  });

  const manager = (
    <MyTasksManager
      initialTasks={joinTasksWithSources(
        tasks,
        sources,
        categories,
        clientOptions,
        assigneesByTask,
        linksByTask,
        attachmentsByTask,
      )}
      initialCategories={categories}
      clientOptions={clientOptions}
      initialProjects={initialProjects}
      initialPeople={people}
      userEmail={user.email}
      isAdmin={isAdmin}
      initialEmailMessages={gmailMessages}
      initialEmailRules={gmailRules}
    />
  );
  if (!auditsNeedDoing) return manager;
  return (
    <div className="bg-bip-page">
      <div className="px-6 pt-6">
        <SeoAuditsDuePanel
          schedules={seoAuditSchedules}
          roster={getStrategistRoster()}
          appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
        />
      </div>
      {manager}
    </div>
  );
}
