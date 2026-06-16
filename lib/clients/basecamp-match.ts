import { isClientMarketingTracked } from "@/lib/clients/marketing-tracked";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import type { BasecampProjectSummary } from "@/lib/basecamp/client";
import type { ClientRow } from "@/lib/types/client";

export type BasecampMatchStatus =
  | "matched"
  | "missing"
  | "conflict"
  | "ambiguous"
  | "already_set";

export type BasecampMatchRow = {
  clientId: number;
  accountName: string;
  currentProjectId: string | null;
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  status: BasecampMatchStatus;
};

export type BasecampUnmatchedProject = {
  projectId: string;
  projectName: string;
  status: string | null;
};

export type BasecampMatchStats = {
  actionableUnmatchedCount: number;
  ignoredUnmatchedCount: number;
  nonMarketingClientsSkipped: number;
};

export type BasecampMatchOptions = {
  ignoredProjectIds?: Set<string>;
  marketingTrackedClientsOnly?: boolean;
};

export type BasecampMatchResult = {
  matched: BasecampMatchRow[];
  conflicts: BasecampMatchRow[];
  ambiguous: BasecampMatchRow[];
  missingClients: BasecampMatchRow[];
  alreadySet: BasecampMatchRow[];
  unmatchedProjects: BasecampUnmatchedProject[];
  ignoredProjects: BasecampUnmatchedProject[];
  stats: BasecampMatchStats;
};

function trimProjectId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildClientNameIndex(clients: ClientRow[]) {
  const byName = new Map<string, ClientRow[]>();
  for (const client of clients) {
    const key = normalizeClientName(client.account_name);
    const bucket = byName.get(key) ?? [];
    bucket.push(client);
    byName.set(key, bucket);
  }
  return byName;
}

function buildProjectNameIndex(projects: BasecampProjectSummary[]) {
  const byName = new Map<string, BasecampProjectSummary[]>();
  for (const project of projects) {
    const bucket = byName.get(project.normalizedName) ?? [];
    bucket.push(project);
    byName.set(project.normalizedName, bucket);
  }
  return byName;
}

function classifyClientMatch(
  client: ClientRow,
  projectCandidates: BasecampProjectSummary[],
  clientCandidates: ClientRow[],
): BasecampMatchRow {
  const currentProjectId = trimProjectId(client.basecamp_project_id);
  const base = {
    clientId: client.id,
    accountName: client.account_name,
    currentProjectId,
    suggestedProjectId: null as string | null,
    suggestedProjectName: null as string | null,
  };

  if (clientCandidates.length > 1 || projectCandidates.length > 1) {
    return {
      ...base,
      suggestedProjectId:
        projectCandidates.length === 1 ? projectCandidates[0]!.id : null,
      suggestedProjectName:
        projectCandidates.length === 1 ? projectCandidates[0]!.name : null,
      status: "ambiguous",
    };
  }

  if (projectCandidates.length === 0) {
    return { ...base, status: "missing" };
  }

  const project = projectCandidates[0]!;
  const withSuggestion = {
    ...base,
    suggestedProjectId: project.id,
    suggestedProjectName: project.name,
  };

  if (!currentProjectId) {
    return { ...withSuggestion, status: "matched" };
  }
  if (currentProjectId === project.id) {
    return { ...withSuggestion, status: "already_set" };
  }
  return { ...withSuggestion, status: "conflict" };
}

export function matchClientsToBasecampProjects(
  clients: ClientRow[],
  projects: BasecampProjectSummary[],
  options: BasecampMatchOptions = {},
): BasecampMatchResult {
  const ignoredProjectIds = options.ignoredProjectIds ?? new Set<string>();
  const marketingTrackedClientsOnly = options.marketingTrackedClientsOnly ?? true;

  let nonMarketingClientsSkipped = 0;
  const clientsForMissing = marketingTrackedClientsOnly
    ? clients.filter((client) => {
        const tracked = isClientMarketingTracked(client);
        if (!tracked) nonMarketingClientsSkipped += 1;
        return tracked;
      })
    : clients;

  const clientByName = buildClientNameIndex(clients);
  const projectByName = buildProjectNameIndex(projects);

  const matched: BasecampMatchRow[] = [];
  const conflicts: BasecampMatchRow[] = [];
  const ambiguous: BasecampMatchRow[] = [];
  const missingClients: BasecampMatchRow[] = [];
  const alreadySet: BasecampMatchRow[] = [];

  for (const client of clients) {
    const key = normalizeClientName(client.account_name);
    const projectCandidates = projectByName.get(key) ?? [];
    const clientCandidates = clientByName.get(key) ?? [];
    const row = classifyClientMatch(client, projectCandidates, clientCandidates);

    switch (row.status) {
      case "matched":
        matched.push(row);
        break;
      case "conflict":
        conflicts.push(row);
        break;
      case "ambiguous":
        ambiguous.push(row);
        break;
      case "already_set":
        alreadySet.push(row);
        break;
    }
  }

  for (const client of clientsForMissing) {
    const key = normalizeClientName(client.account_name);
    const projectCandidates = projectByName.get(key) ?? [];
    const clientCandidates = clientByName.get(key) ?? [];
    const row = classifyClientMatch(client, projectCandidates, clientCandidates);
    if (row.status === "missing") {
      missingClients.push(row);
    }
  }

  const unmatchedProjects: BasecampUnmatchedProject[] = [];
  const ignoredProjects: BasecampUnmatchedProject[] = [];

  for (const project of projects) {
    const clientCandidates = clientByName.get(project.normalizedName) ?? [];
    if (clientCandidates.length === 1) {
      continue;
    }

    const entry: BasecampUnmatchedProject = {
      projectId: project.id,
      projectName: project.name,
      status: project.status,
    };

    if (ignoredProjectIds.has(project.id)) {
      ignoredProjects.push(entry);
    } else {
      unmatchedProjects.push(entry);
    }
  }

  unmatchedProjects.sort((left, right) =>
    left.projectName.localeCompare(right.projectName),
  );
  ignoredProjects.sort((left, right) =>
    left.projectName.localeCompare(right.projectName),
  );

  return {
    matched,
    conflicts,
    ambiguous,
    missingClients,
    alreadySet,
    unmatchedProjects,
    ignoredProjects,
    stats: {
      actionableUnmatchedCount: unmatchedProjects.length,
      ignoredUnmatchedCount: ignoredProjects.length,
      nonMarketingClientsSkipped,
    },
  };
}

export function findDuplicateBasecampProjectAssignments(clients: ClientRow[]) {
  const byProjectId = new Map<string, number[]>();
  for (const client of clients) {
    const projectId = trimProjectId(client.basecamp_project_id);
    if (!projectId) continue;
    const bucket = byProjectId.get(projectId) ?? [];
    bucket.push(client.id);
    byProjectId.set(projectId, bucket);
  }
  return byProjectId;
}
