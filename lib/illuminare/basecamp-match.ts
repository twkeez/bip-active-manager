// Matches Illuminare clients to Basecamp projects by normalized name.
// Each client is a separate project, so a clean match is a 1:1 name hit.
import { normalizeClientName } from "@/lib/clients/normalize-name";
import type { BasecampProjectSummary } from "@/lib/basecamp/client";
import type { IlluminareClientRow } from "@/lib/illuminare/types";

export type IlluminareMatchStatus =
  | "already_set" // current link matches the suggestion
  | "matched" // clean single-name match, not yet linked
  | "conflict" // linked to a different project than the name suggests
  | "ambiguous" // more than one project shares the name
  | "missing"; // no project matches the name

export type IlluminareProjectMatch = {
  clientId: number;
  accountName: string;
  currentProjectId: string | null;
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  status: IlluminareMatchStatus;
};

export type IlluminareMatchResult = {
  matches: IlluminareProjectMatch[];
  unmatchedProjects: BasecampProjectSummary[];
};

function trim(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : null;
}

export function matchIlluminareProjects(
  clients: Pick<IlluminareClientRow, "id" | "account_name" | "basecamp_project_id">[],
  projects: BasecampProjectSummary[],
): IlluminareMatchResult {
  const projectsByName = new Map<string, BasecampProjectSummary[]>();
  for (const project of projects) {
    const bucket = projectsByName.get(project.normalizedName) ?? [];
    bucket.push(project);
    projectsByName.set(project.normalizedName, bucket);
  }

  const clientNameKeys = new Set(
    clients.map((client) => normalizeClientName(client.account_name)),
  );

  const matches: IlluminareProjectMatch[] = [];
  for (const client of clients) {
    const key = normalizeClientName(client.account_name);
    const candidates = projectsByName.get(key) ?? [];
    const current = trim(client.basecamp_project_id);
    const base = {
      clientId: client.id,
      accountName: client.account_name,
      currentProjectId: current,
      suggestedProjectId: null as string | null,
      suggestedProjectName: null as string | null,
    };

    if (candidates.length > 1) {
      matches.push({ ...base, status: "ambiguous" });
      continue;
    }
    if (candidates.length === 0) {
      matches.push({ ...base, status: "missing" });
      continue;
    }

    const project = candidates[0]!;
    const withSuggestion = {
      ...base,
      suggestedProjectId: project.id,
      suggestedProjectName: project.name,
    };
    if (!current) {
      matches.push({ ...withSuggestion, status: "matched" });
    } else if (current === project.id) {
      matches.push({ ...withSuggestion, status: "already_set" });
    } else {
      matches.push({ ...withSuggestion, status: "conflict" });
    }
  }

  // Projects that don't correspond 1:1 to a client name.
  const unmatchedProjects = projects
    .filter((project) => {
      const sameName = projectsByName.get(project.normalizedName) ?? [];
      return !(clientNameKeys.has(project.normalizedName) && sameName.length === 1);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { matches, unmatchedProjects };
}
