/**
 * What the Basecamp sync should walk.
 *
 * This used to be "the clients table", which quietly made the monitor a
 * report on our own records rather than on Basecamp. A project with no client
 * record was never fetched, so it could never appear in a finding — it looked
 * exactly like a project with nothing wrong. 55 active projects were in that
 * state.
 *
 * The roster is now every active Basecamp project, plus every project a client
 * points at even if Basecamp did not list it. A client is an optional label on
 * a project, not the reason to look at it.
 */

export type RosterClient = {
  id: number;
  basecamp_project_id: string | null;
  reply_acknowledged_for_occurred_at?: string | null;
};

export type RosterProject = {
  projectId: string;
  /** Null when the project came only from a client record. */
  projectName: string | null;
  /** The client that owns this project's aggregate, lowest id wins. */
  clientId: number | null;
  replyAckForOccurredAt: string | null;
  /** Other client records claiming the same project — a wiring problem. */
  duplicateClientIds: number[];
  /** True when Basecamp listed it; false when only a client record knew of it. */
  listedByBasecamp: boolean;
};

function trim(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildSyncRoster(
  basecampProjects: Array<{ id: string; name: string }>,
  clients: RosterClient[],
): RosterProject[] {
  // Lowest client id owns a contested project, matching what the sync did
  // before, so which client an aggregate lands on does not change today.
  const claimants = new Map<string, number[]>();
  const ackByClient = new Map<number, string | null>();
  for (const client of [...clients].sort((a, b) => a.id - b.id)) {
    ackByClient.set(client.id, client.reply_acknowledged_for_occurred_at ?? null);
    const projectId = trim(client.basecamp_project_id);
    if (!projectId) continue;
    claimants.set(projectId, [...(claimants.get(projectId) ?? []), client.id]);
  }

  const roster = new Map<string, RosterProject>();

  const add = (projectId: string, projectName: string | null, listed: boolean) => {
    if (roster.has(projectId)) return;
    const owners = claimants.get(projectId) ?? [];
    const [owner, ...duplicates] = owners;
    roster.set(projectId, {
      projectId,
      projectName,
      clientId: owner ?? null,
      replyAckForOccurredAt: owner != null ? (ackByClient.get(owner) ?? null) : null,
      duplicateClientIds: duplicates,
      listedByBasecamp: listed,
    });
  };

  for (const project of basecampProjects) {
    const projectId = trim(project.id);
    if (!projectId) continue;
    add(projectId, trim(project.name), true);
  }

  // Anything a client points at that Basecamp did not list — an archived
  // project, or a truncated API response. Dropping these would silently
  // narrow coverage we already had, which is the worse failure.
  for (const projectId of claimants.keys()) {
    add(projectId, null, false);
  }

  return [...roster.values()];
}
