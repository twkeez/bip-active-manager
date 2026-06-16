import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientProject,
  ClientProjectArtifact,
  ClientProjectPhase,
  TaskClientOption,
  UserTask,
} from "@/lib/types/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listProjectArtifacts,
  listProjectPhases,
} from "@/lib/projects/access";

function truncate(value: string, max = 1200) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

export type ProjectAiContext = {
  client: (TaskClientOption & { website?: string | null }) | null;
  project: ClientProject;
  phases: ClientProjectPhase[];
  openTasks: Pick<
    UserTask,
    "title" | "status" | "priority" | "due_date"
  >[];
  recentArtifacts: ClientProjectArtifact[];
  gscSummary: string | null;
};

export async function buildProjectAiContext(
  supabase: SupabaseClient,
  userId: string,
  project: ClientProject,
): Promise<ProjectAiContext> {
  const admin = createAdminClient();
  const [clientRow, phases, artifacts, tasksResult, gscSnapshot] = await Promise.all([
    project.client_id != null
      ? admin
          .from("clients")
          .select("id,account_name,website")
          .eq("id", project.client_id)
          .maybeSingle<{ id: number; account_name: string; website: string | null }>()
      : Promise.resolve({ data: null }),
    listProjectPhases(supabase, userId, project.id),
    listProjectArtifacts(supabase, userId, project.id, 5),
    supabase
      .from("user_tasks")
      .select("title,status,priority,due_date")
      .eq("owner_user_id", userId)
      .eq("project_id", project.id)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    project.client_id != null
      ? admin
          .from("client_gsc_snapshots")
          .select("id,updated_at")
          .eq("client_id", project.client_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ id: number; updated_at: string }>()
      : Promise.resolve({ data: null }),
  ]);

  let gscSummary: string | null = null;
  const latestGsc = gscSnapshot.data;
  if (latestGsc?.id) {
    const { data: pageRows } = await admin
      .from("client_gsc_page_metrics")
      .select("clicks,impressions")
      .eq("snapshot_id", latestGsc.id);
    const clicks = (pageRows ?? []).reduce(
      (sum, row) => sum + (row.clicks ?? 0),
      0,
    );
    const impressions = (pageRows ?? []).reduce(
      (sum, row) => sum + (row.impressions ?? 0),
      0,
    );
    const ctr =
      impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
    gscSummary = `GSC (latest snapshot): ${clicks} clicks, ${impressions} impressions, ${ctr}% CTR`;
  }

  const client = clientRow.data ?? null;

  return {
    client,
    project,
    phases,
    openTasks: (tasksResult.data ?? []) as Pick<
      UserTask,
      "title" | "status" | "priority" | "due_date"
    >[],
    recentArtifacts: artifacts,
    gscSummary,
  };
}

export function formatProjectAiContext(ctx: ProjectAiContext) {
  const phaseLines = ctx.phases.length
    ? ctx.phases
        .map(
          (phase, index) =>
            `${index + 1}. [${phase.status}] ${phase.title}${phase.notes ? ` — ${phase.notes}` : ""}`,
        )
        .join("\n")
    : "No phases defined yet.";

  const taskLines = ctx.openTasks.length
    ? ctx.openTasks
        .map(
          (task) =>
            `- [${task.status}/${task.priority}] ${task.title}${task.due_date ? ` (due ${task.due_date})` : ""}`,
        )
        .join("\n")
    : "No open project tasks.";

  const artifactLines = ctx.recentArtifacts.length
    ? ctx.recentArtifacts
        .map(
          (artifact) =>
            `- ${artifact.artifact_type}: ${artifact.title} (${artifact.created_at.slice(0, 10)})\n${truncate(artifact.content_markdown, 400)}`,
        )
        .join("\n\n")
    : "No prior artifacts.";

  return [
    ctx.client
      ? `Client: ${ctx.client.account_name}\nWebsite: ${ctx.client.website ?? "N/A"}`
      : "Client: Internal (no client assigned)",
    "",
    `Project: ${ctx.project.name}`,
    `Status: ${ctx.project.status}`,
    `Objective: ${ctx.project.objective ?? "Not set"}`,
    `Description: ${ctx.project.description ?? "Not set"}`,
    `Target dates: ${ctx.project.target_start_date ?? "?"} → ${ctx.project.target_end_date ?? "?"}`,
    "",
    "Phases:",
    phaseLines,
    "",
    "Open tasks:",
    taskLines,
    "",
    "Recent artifacts:",
    artifactLines,
    ctx.gscSummary ? `\n${ctx.gscSummary}` : "",
  ].join("\n");
}
