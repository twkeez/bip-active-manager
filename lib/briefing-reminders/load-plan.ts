import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientActiveServices, isLowContact } from "@/lib/clients/service-active";
import type { ClientRow } from "@/lib/types/client";
import { planRun, upcomingRuns, type LeftOut, type PlanClient, type PlannedReminder, type ReminderRun } from "./plan";

export type RunPlan = ReminderRun & { reminders: PlannedReminder[]; leftOut: LeftOut[] };

/**
 * The next two reminder runs as they would go out today: every client buying
 * a marketing service, who each reminder goes to, and what to fix first.
 * Read with the service role: staff emails are behind per-person RLS.
 */
export async function loadReminderPlan(admin: SupabaseClient, now: Date = new Date()): Promise<RunPlan[]> {
  const [clientsResult, projectsResult, ignoresResult, staffResult] = await Promise.all([
    admin
      .from("clients")
      .select("id, account_name, marketing_strategist, tier, is_low_contact, basecamp_project_id, seo, ppc, smm, blog, orm")
      .order("account_name"),
    admin.from("basecamp_projects").select("basecamp_project_id, client_id").not("client_id", "is", null),
    admin.from("basecamp_project_ignores").select("basecamp_project_id, reason"),
    admin.from("profiles").select("full_name, email").not("email", "is", null),
  ]);
  if (clientsResult.error) throw new Error(`Could not read clients: ${clientsResult.error.message}`);

  // A client's project: the roster's link first (one owner per project), then
  // the id on the client record.
  const projectByClient = new Map<number, string>();
  for (const row of (projectsResult.data ?? []) as Array<{ basecamp_project_id: string; client_id: number }>) {
    projectByClient.set(row.client_id, row.basecamp_project_id);
  }
  const ignoredReason = new Map<string, string>();
  for (const row of (ignoresResult.data ?? []) as Array<{ basecamp_project_id: string; reason: string | null }>) {
    ignoredReason.set(row.basecamp_project_id, row.reason?.trim() || "no reason given");
  }

  const clients: PlanClient[] = ((clientsResult.data ?? []) as ClientRow[])
    .filter((client) => Object.values(getClientActiveServices(client)).some(Boolean))
    .map((client) => {
      const projectId =
        projectByClient.get(client.id) ?? (client.basecamp_project_id ? String(client.basecamp_project_id) : null);
      return {
        id: client.id,
        accountName: client.account_name,
        marketingStrategist: client.marketing_strategist ?? null,
        isLowContact: isLowContact(client),
        basecampProjectId: projectId,
        ignoredReason: projectId ? (ignoredReason.get(projectId) ?? null) : null,
      };
    });

  const staff = (staffResult.data ?? []) as Array<{ full_name: string | null; email: string | null }>;
  return upcomingRuns(now, 2).map((run) => ({ ...run, ...planRun(clients, staff, run.slot) }));
}
