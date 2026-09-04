import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import { loadBasecampProjectsForMatch } from "@/lib/basecamp/client";
import { matchClientsToBasecampProjects } from "@/lib/clients/basecamp-match";
import { listBasecampProjectIgnores } from "@/lib/clients/basecamp-project-ignores";
import { triageProjectName } from "@/lib/clients/basecamp-project-triage";
import { isClientMarketingTracked } from "@/lib/clients/marketing-tracked";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { findProjectWiringProblems } from "@/lib/coal-mines/project-wiring";
import type { BasecampProjectSummary } from "@/lib/basecamp/client";
import type { ClientRow } from "@/lib/types/client";
import BasecampProjectMatcher from "@/components/clients/basecamp-project-matcher";

export const dynamic = "force-dynamic";

/**
 * Wiring clients to Basecamp projects.
 *
 * The match / apply / ignore / import endpoints have existed for a while with
 * nothing calling them — this is the screen they were missing. Coal Mines can
 * report that clients are being skipped and that most Basecamp projects have no
 * client record, but until now there was nowhere to go and fix it.
 *
 * Project names appear everywhere, because the name is usually the whole
 * explanation: a project called "Long Meadow Veterinary Clinic/Animal ER of
 * Northwest Houston" says immediately why three client records claim it.
 */
export default async function BasecampProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("*")
    .order("account_name", { ascending: true });
  const clients = (clientsRaw ?? []) as ClientRow[];

  let projects: BasecampProjectSummary[] = [];
  let loadError: string | null = null;
  try {
    ({ projects } = await loadBasecampProjectsForMatch(normalizeClientName));
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Could not load Basecamp projects";
  }

  const ignores = await listBasecampProjectIgnores(supabase);
  const match = matchClientsToBasecampProjects(clients, projects, {
    ignoredProjectIds: new Set(ignores.map((row) => row.basecamp_project_id)),
    marketingTrackedClientsOnly: true,
  });

  // Same duplicate detection the Coal Mines canary reports, so the two screens
  // can never disagree about which clients are being skipped.
  const wiring = findProjectWiringProblems(clients);
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <BasecampProjectMatcher
      loadError={loadError}
      projectCount={projects.length}
      clientCount={clients.length}
      trackedCount={clients.filter(isClientMarketingTracked).length}
      linkableClients={clients
        .filter((client) => !client.basecamp_project_id?.trim())
        .map((client) => ({ id: client.id, name: client.account_name }))}
      linkedCount={wiring.linked}
      skippedCount={wiring.skippedClients}
      duplicates={wiring.duplicates.map((group) => ({
        ...group,
        projectName: projectNameById.get(group.projectId) ?? null,
      }))}
      readyToLink={match.matched.map((row) => ({
        clientId: row.clientId,
        accountName: row.accountName,
        projectId: row.suggestedProjectId ?? "",
        projectName: row.suggestedProjectName ?? "",
      }))}
      ambiguous={match.ambiguous.map((row) => ({
        clientId: row.clientId,
        accountName: row.accountName,
        currentProjectId: row.currentProjectId,
        projectId: row.suggestedProjectId,
        projectName: row.suggestedProjectName,
      }))}
      nameConflicts={match.conflicts.map((row) => ({
        clientId: row.clientId,
        accountName: row.accountName,
        currentProjectId: row.currentProjectId,
        currentProjectName: row.currentProjectId
          ? (projectNameById.get(row.currentProjectId) ?? null)
          : null,
        projectId: row.suggestedProjectId,
        projectName: row.suggestedProjectName,
      }))}
      unmatched={match.unmatchedProjects.map((project) => ({
        projectId: project.projectId,
        projectName: project.projectName,
        ...triageProjectName(project.projectName),
      }))}
      ignored={ignores.map((row) => ({
        projectId: row.basecamp_project_id,
        projectName: row.project_name,
        reason: row.reason,
      }))}
      accountId={process.env.BASECAMP_ACCOUNT_ID?.trim() || null}
      strategists={[
        ...new Set(
          clients
            .map((client) => client.marketing_strategist?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ].sort()}
    />
  );
}
