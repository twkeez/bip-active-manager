/**
 * Client records that point at the wrong Basecamp project, or at one another's.
 *
 * This used to be a monitoring hole: the sync walked the clients table and gave
 * each project to one client per run, so the other records were passed over and
 * their threads were never read. The sync now walks Basecamp's own project list
 * (see lib/basecamp/sync-roster.ts), so the threads are safe either way.
 *
 * What is left is still worth reporting. A project's activity lands on exactly
 * one client record, so the others show no recent communication and read as
 * quiet on the comms monitor when they are not.
 *
 * Found on live data: three of 89 clients, across two shared projects.
 */

export type ClientProjectRow = {
  id: number;
  account_name: string;
  basecamp_project_id: string | null;
};

export type DuplicateProjectGroup = {
  projectId: string;
  clients: Array<{ id: number; name: string }>;
};

export type ProjectWiring = {
  /** Clients sharing a project id with at least one other client. */
  duplicates: DuplicateProjectGroup[];
  /** How many client records do not own the project they point at. */
  skippedClients: number;
  /** Clients with a Basecamp project, for context. */
  linked: number;
};

export function findProjectWiringProblems(rows: ClientProjectRow[]): ProjectWiring {
  const byProject = new Map<string, Array<{ id: number; name: string }>>();

  for (const row of rows) {
    const projectId = row.basecamp_project_id?.trim();
    if (!projectId) continue;
    const list = byProject.get(projectId) ?? [];
    list.push({ id: row.id, name: row.account_name });
    byProject.set(projectId, list);
  }

  const duplicates = [...byProject.entries()]
    .filter(([, clients]) => clients.length > 1)
    .map(([projectId, clients]) => ({
      projectId,
      // Lowest id first: the sync processes in a stable order, so the first is
      // the one that keeps the project and the rest are the ones skipped.
      clients: [...clients].sort((a, b) => a.id - b.id),
    }))
    .sort((a, b) => b.clients.length - a.clients.length);

  const skippedClients = duplicates.reduce((sum, g) => sum + g.clients.length - 1, 0);

  return {
    duplicates,
    skippedClients,
    linked: [...byProject.values()].reduce((sum, list) => sum + list.length, 0),
  };
}
