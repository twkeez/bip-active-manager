/**
 * Client records that point at the wrong Basecamp project, or at one another's.
 *
 * The sync claims a project for exactly one client per run, so when two client
 * records carry the same basecamp_project_id the second is skipped outright.
 * Those clients get no thread monitoring at all, and nothing says so — they
 * simply never appear in any finding, which reads exactly like having nothing
 * wrong.
 *
 * Found on live data: three of 89 clients were being skipped this way.
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
  /** How many client records are skipped as a result. */
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
