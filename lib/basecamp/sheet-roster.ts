import type { SupabaseClient } from "@supabase/supabase-js";
import { distinctiveTokens, matchToMasterSheet, type MasterSheetRow } from "@/lib/clients/master-sheet";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";

/**
 * The roster: every practice on Master Sheet 2026 with a Package, matched to
 * its BIP Control client and Basecamp project.
 *
 * This is the list the Response Report and the Poobah connector answer for.
 * A sheet row is matched to a client by exact name, or by the sheet name saved
 * on the client (clients.master_sheet_name) when the two differ. Nothing is
 * matched by resemblance: a row that fits no client, or fits several, is
 * reported with look-alikes as suggestions and left for a person to settle.
 */

export type RosterSheetRow = {
  practiceName: string;
  normalizedName: string;
  packageValue: string | null;
  strategist: string | null;
};

export type RosterClient = {
  id: number;
  account_name: string;
  basecamp_project_id: string | null;
  master_sheet_name?: string | null;
};

export type RosterCandidate = { clientId: number; clientName: string; projectId: string | null };

export type RosterState =
  /** Matched to one client that has a Basecamp project. */
  | "ready"
  /** Matched to one client, but it has no Basecamp project linked. */
  | "no_project"
  /** No client has this name. */
  | "unmatched"
  /** Several clients have this name. */
  | "ambiguous";

export type RosterEntry = {
  practiceName: string;
  packageValue: string;
  /** Column I on the sheet, as typed. Null when blank. */
  strategist: string | null;
  state: RosterState;
  clientId: number | null;
  clientName: string | null;
  projectId: string | null;
  matchedBy: "name" | "saved_name" | null;
  /** Ambiguous: the clients sharing the name. Unmatched: look-alikes, as suggestions only. */
  candidates: RosterCandidate[];
  /** Other roster practices whose client points at the same Basecamp project. */
  sharesProjectWith: string[];
};

export type RosterCounts = {
  /** Sheet rows with a Package: the number the roster answers for. */
  inScope: number;
  ready: number;
  noProject: number;
  unmatched: number;
  ambiguous: number;
};

/** A Basecamp project that more than one client record points at. */
export type SharedProject = {
  projectId: string;
  claimants: Array<{ clientId: number; clientName: string; practiceName: string | null }>;
  /**
   * "shared": every client pointing at it is its own practice on the roster
   * (one project genuinely serving two practices), which is fine.
   * "problem": at least one is not, which usually means a duplicate client record.
   */
  kind: "shared" | "problem";
};

export type SheetRoster = {
  entries: RosterEntry[];
  counts: RosterCounts;
  /** Every project claimed by more than one client record, roster or not. */
  sharedProjects: SharedProject[];
  /** Roster rows whose Strategist is blank or a placeholder such as "NEED". */
  needsStrategist: string[];
};

const PLACEHOLDER_STRATEGISTS = new Set(["need", "needed", "tbd", "?", "n/a", "na", "none"]);

function trimmed(value: string | null | undefined) {
  const out = value?.trim();
  return out ? out : null;
}

function candidate(client: RosterClient): RosterCandidate {
  return { clientId: client.id, clientName: client.account_name, projectId: trimmed(client.basecamp_project_id) };
}

/** Clients that resemble a sheet row. Shown to help a person decide; never used to match. */
function lookAlikes(row: RosterSheetRow, clients: RosterClient[]): RosterCandidate[] {
  const asSheet: MasterSheetRow = {
    practiceName: row.practiceName,
    normalizedName: row.normalizedName,
    url: null,
    city: null,
    state: null,
    packageValue: row.packageValue,
    strategist: row.strategist,
  };
  // Only names sharing an identifying word ("birchwood"), so the suggestions
  // are not just every other "pet hospital".
  const core = distinctiveTokens(row.practiceName);
  const scored: Array<{ client: RosterClient; score: number }> = [];
  for (const client of clients) {
    if (![...distinctiveTokens(client.account_name)].some((token) => core.has(token))) continue;
    const match = matchToMasterSheet(client.account_name, [asSheet]);
    if (match.confidence !== "none") scored.push({ client, score: 1 });
    else if (match.nearest) scored.push({ client, score: match.nearest.score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.client.id - b.client.id)
    .slice(0, 3)
    .map((entry) => candidate(entry.client));
}

export function buildSheetRoster(sheet: RosterSheetRow[], clients: RosterClient[]): SheetRoster {
  const bySavedName = new Map<string, RosterClient[]>();
  const byName = new Map<string, RosterClient[]>();
  const push = (map: Map<string, RosterClient[]>, key: string, client: RosterClient) => {
    if (key) map.set(key, [...(map.get(key) ?? []), client]);
  };
  for (const client of [...clients].sort((a, b) => a.id - b.id)) {
    const saved = trimmed(client.master_sheet_name);
    // A client with a saved sheet name answers to that name only, so one
    // client can never stand in for two sheet rows.
    if (saved) push(bySavedName, normalizeClientName(saved), client);
    else push(byName, normalizeClientName(client.account_name), client);
  }

  const entries: RosterEntry[] = [];
  for (const row of sheet) {
    const packageValue = trimmed(row.packageValue);
    if (!packageValue) continue;

    // A saved sheet name is a person's answer, so it outranks a name that
    // merely happens to be the same.
    const saved = bySavedName.get(row.normalizedName) ?? [];
    const named = byName.get(row.normalizedName) ?? [];
    const hits = saved.length ? saved : named;
    const matchedBy = saved.length ? "saved_name" : "name";

    const base = {
      practiceName: row.practiceName,
      packageValue,
      strategist: trimmed(row.strategist),
      sharesProjectWith: [] as string[],
    };
    if (hits.length === 1) {
      const client = hits[0]!;
      const projectId = trimmed(client.basecamp_project_id);
      entries.push({
        ...base,
        state: projectId ? "ready" : "no_project",
        clientId: client.id,
        clientName: client.account_name,
        projectId,
        matchedBy,
        candidates: [],
      });
    } else {
      entries.push({
        ...base,
        state: hits.length ? "ambiguous" : "unmatched",
        clientId: null,
        clientName: null,
        projectId: null,
        matchedBy: null,
        candidates: hits.length ? hits.map(candidate) : lookAlikes(row, clients),
      });
    }
  }

  const byProject = new Map<string, RosterEntry[]>();
  for (const entry of entries) {
    if (entry.projectId) byProject.set(entry.projectId, [...(byProject.get(entry.projectId) ?? []), entry]);
  }
  for (const group of byProject.values()) {
    if (group.length < 2) continue;
    for (const entry of group) {
      entry.sharesProjectWith = group.filter((other) => other !== entry).map((other) => other.practiceName);
    }
  }

  const practiceByClient = new Map<number, string>();
  for (const entry of entries) if (entry.clientId != null) practiceByClient.set(entry.clientId, entry.practiceName);
  const claims = new Map<string, RosterClient[]>();
  for (const client of [...clients].sort((a, b) => a.id - b.id)) {
    const projectId = trimmed(client.basecamp_project_id);
    if (projectId) claims.set(projectId, [...(claims.get(projectId) ?? []), client]);
  }
  const sharedProjects: SharedProject[] = [];
  for (const [projectId, group] of claims) {
    if (group.length < 2) continue;
    const claimants = group.map((client) => ({
      clientId: client.id,
      clientName: client.account_name,
      practiceName: practiceByClient.get(client.id) ?? null,
    }));
    sharedProjects.push({ projectId, claimants, kind: claimants.every((c) => c.practiceName) ? "shared" : "problem" });
  }

  const count = (state: RosterState) => entries.filter((entry) => entry.state === state).length;
  return {
    entries,
    sharedProjects,
    counts: {
      inScope: entries.length,
      ready: count("ready"),
      noProject: count("no_project"),
      unmatched: count("unmatched"),
      ambiguous: count("ambiguous"),
    },
    needsStrategist: entries
      .filter((entry) => !entry.strategist || PLACEHOLDER_STRATEGISTS.has(entry.strategist.toLowerCase()))
      .map((entry) => entry.practiceName),
  };
}

// --- Loading ---------------------------------------------------------------

/** The sheet is re-read every morning; a copy older than this missed a day. */
export const ROSTER_STALE_AFTER_HOURS = 36;
/** The real sheet lists a couple of hundred practices; fewer means a broken copy. */
const MIN_STORED_PRACTICES = 25;

export type LoadedSheetRoster = SheetRoster & {
  /** Set when the roster could not be built at all. Never an empty roster passed off as real. */
  error: string | null;
  /** When the stored copy of the sheet was read from Google. */
  sheetReadAt: string | null;
  /** Practices on the sheet, with or without a Package. */
  sheetTotal: number;
  /** Things that make the roster less than complete, in plain words. */
  warnings: string[];
};

const EMPTY: SheetRoster = {
  entries: [],
  sharedProjects: [],
  counts: { inScope: 0, ready: 0, noProject: 0, unmatched: 0, ambiguous: 0 },
  needsStrategist: [],
};

type StoredRow = {
  id: number;
  practice_name: string;
  normalized_name: string;
  package_value: string | null;
  strategist: string | null;
  imported_at: string;
};

export async function loadSheetRoster(supabase: SupabaseClient, now = Date.now()): Promise<LoadedSheetRoster> {
  const failed = (error: string): LoadedSheetRoster => ({ ...EMPTY, error, sheetReadAt: null, sheetTotal: 0, warnings: [] });
  const warnings: string[] = [];

  let stored: StoredRow[];
  try {
    stored = await fetchAllRows<StoredRow>(
      (from, to) =>
        supabase
          .from("master_sheet_practices")
          .select("id,practice_name,normalized_name,package_value,strategist,imported_at")
          .order("id")
          .range(from, to),
      "Master Sheet copy",
    );
  } catch (error) {
    return failed(`Could not read the stored copy of the Master Sheet: ${(error as Error).message}`);
  }
  if (stored.length < MIN_STORED_PRACTICES) {
    return failed(
      `The stored copy of the Master Sheet has only ${stored.length} practices, so it is missing or incomplete. Refresh it from Project Wiring, then reload.`,
    );
  }

  const readClients = (columns: string) =>
    fetchAllRows<RosterClient>(
      (from, to) => supabase.from("clients").select(columns).order("id").range(from, to),
      "clients",
    );
  let clients: RosterClient[];
  try {
    clients = await readClients("id,account_name,basecamp_project_id,master_sheet_name");
  } catch (error) {
    // The saved-sheet-name column ships as a migration pasted by hand, so "not
    // run yet" is a real state: carry on by name alone, and say so.
    if (!/master_sheet_name/.test((error as Error).message)) {
      return failed(`Could not read the clients: ${(error as Error).message}`);
    }
    try {
      clients = await readClients("id,account_name,basecamp_project_id");
    } catch (retryError) {
      return failed(`Could not read the clients: ${(retryError as Error).message}`);
    }
    warnings.push(
      "Saved sheet names are not set up yet (run supabase/migrations/20261124120000_client_master_sheet_name.sql), so clients are matched by exact name only.",
    );
  }

  const sheetReadAt = stored.reduce<string | null>(
    (latest, row) => (!latest || row.imported_at > latest ? row.imported_at : latest),
    null,
  );
  const ageHours = sheetReadAt ? (now - new Date(sheetReadAt).getTime()) / 3_600_000 : Infinity;
  if (ageHours > ROSTER_STALE_AFTER_HOURS) {
    warnings.push(
      `The Master Sheet was last read ${Math.floor(ageHours / 24)} days ago, so newer changes to the sheet are missing. It should refresh every morning.`,
    );
  }

  const roster = buildSheetRoster(
    stored.map((row) => ({
      practiceName: row.practice_name,
      normalizedName: row.normalized_name,
      packageValue: row.package_value,
      strategist: row.strategist,
    })),
    clients,
  );
  return { ...roster, error: null, sheetReadAt, sheetTotal: stored.length, warnings };
}
