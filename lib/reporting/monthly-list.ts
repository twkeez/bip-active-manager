import type { SupabaseClient } from "@supabase/supabase-js";
import type { RosterEntry } from "@/lib/basecamp/sheet-roster";
import { loadSheetRoster } from "@/lib/basecamp/sheet-roster";
import { accountStatusOf, ACCOUNT_STATUS_MIGRATION, type AccountStatus } from "@/lib/clients/account-status";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import {
  countStates,
  isMissingMonthlyTable,
  monthStartDate,
  MONTHLY_REPORTS_MIGRATION,
  parseSentVia,
  stateOf,
  type MonthKey,
  type ReportState,
  type SentVia,
  type StateCounts,
} from "@/lib/reporting/monthly";

/**
 * The Reporting page's list: every Master Sheet client with a Package that the
 * viewer can see, and where its report stands for one month.
 *
 * Which clients: the same roster as the Response Report (lib/basecamp/sheet-roster.ts),
 * narrowed to the clients the viewer's own session can read. Admins see them
 * all; a strategist sees the clients assigned to them. Former clients are left
 * off and counted. A sheet row that isn't matched to a client can't have a
 * report, so admins see those named, never dropped quietly.
 */

export type MonthlyListRow = {
  clientId: number;
  name: string;
  strategist: string | null;
  packageValue: string;
  accountStatus: AccountStatus;
  state: ReportState;
  sentVia: SentVia[];
  /** When the state last changed. Null when not started. */
  stateChangedAt: string | null;
  /** When a Word export or the print view last produced a report, any month. */
  lastExportAt: string | null;
};

export type MonthlyList = {
  month: MonthKey;
  rows: MonthlyListRow[];
  counts: StateCounts;
  /** Former clients on the sheet with a Package, left off the list. */
  formerLeftOff: string[];
  /** Sheet rows with a Package that match no single client (admins only). */
  unmatched: string[];
  /** False until monthly_reports exists; states then show as unknown. */
  statesTracked: boolean;
  /** Set when the list can't be built at all. Never an empty list passed off as real. */
  error: string | null;
  /** Things that make the list less than complete, in plain words. */
  warnings: string[];
  sheetReadAt: string | null;
};

export type VisibleClient = {
  id: number;
  account_name: string;
  account_status?: string | null;
  last_report_run_at?: string | null;
};

export type StoredMonthRow = {
  client_id: number;
  status: string;
  sent_via: unknown;
  updated_at: string | null;
};

/** Puts the roster, the viewer's clients and the month's saved states together. Pure, so it's tested directly. */
export function buildMonthlyList(input: {
  month: MonthKey;
  entries: RosterEntry[];
  visibleClients: VisibleClient[];
  stored: StoredMonthRow[];
  isAdmin: boolean;
}): Pick<MonthlyList, "rows" | "counts" | "formerLeftOff" | "unmatched"> {
  const visible = new Map(input.visibleClients.map((client) => [client.id, client]));
  const stored = new Map(input.stored.map((row) => [row.client_id, row]));
  const rows: MonthlyListRow[] = [];
  const formerLeftOff: string[] = [];
  const unmatched: string[] = [];
  const seen = new Set<number>();

  for (const entry of input.entries) {
    if (entry.clientId == null) {
      if (input.isAdmin) unmatched.push(entry.practiceName);
      continue;
    }
    const client = visible.get(entry.clientId);
    if (!client || seen.has(client.id)) continue;
    seen.add(client.id);
    const accountStatus = accountStatusOf(client.account_status);
    if (accountStatus === "former") {
      formerLeftOff.push(entry.practiceName);
      continue;
    }
    const saved = stored.get(client.id);
    const state = stateOf(saved);
    rows.push({
      clientId: client.id,
      name: entry.practiceName,
      strategist: entry.strategist,
      packageValue: entry.packageValue,
      accountStatus,
      state,
      sentVia: state === "sent" ? parseSentVia(saved?.sent_via) : [],
      stateChangedAt: state === "not_started" ? null : (saved?.updated_at ?? null),
      lastExportAt: client.last_report_run_at ?? null,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return {
    rows,
    counts: countStates(rows.map((row) => row.state)),
    formerLeftOff: formerLeftOff.sort((a, b) => a.localeCompare(b)),
    unmatched: unmatched.sort((a, b) => a.localeCompare(b)),
  };
}

async function readVisibleClients(supabase: SupabaseClient, warnings: string[]): Promise<VisibleClient[]> {
  const read = (columns: string) =>
    fetchAllRows<VisibleClient>(
      (from, to) => supabase.from("clients").select(columns).order("id").range(from, to),
      "clients",
    );
  try {
    return await read("id,account_name,account_status,last_report_run_at");
  } catch (error) {
    const message = (error as Error).message;
    if (!/account_status|last_report_run_at/.test(message)) throw error;
  }
  // Either column ships as a migration pasted by hand, so "not run yet" is a
  // real state: carry on without it, and say what that means.
  try {
    const rows = await read("id,account_name,account_status");
    warnings.push("The last export date isn't set up yet, so the Last export column is empty.");
    return rows;
  } catch (error) {
    if (!/account_status/.test((error as Error).message)) throw error;
  }
  warnings.push(
    `Client status isn't set up yet (run ${ACCOUNT_STATUS_MIGRATION}), so former clients can't be left off and every client counts as active.`,
  );
  return read("id,account_name");
}

export async function loadMonthlyList(
  supabase: SupabaseClient,
  month: MonthKey,
  isAdmin: boolean,
): Promise<MonthlyList> {
  const empty = { rows: [], counts: countStates([]), formerLeftOff: [], unmatched: [] };
  const warnings: string[] = [];

  const roster = await loadSheetRoster(supabase);
  if (roster.error) {
    return { month, ...empty, statesTracked: false, error: roster.error, warnings: [], sheetReadAt: null };
  }
  warnings.push(...roster.warnings);

  let visibleClients: VisibleClient[];
  try {
    visibleClients = await readVisibleClients(supabase, warnings);
  } catch (error) {
    return {
      month,
      ...empty,
      statesTracked: false,
      error: `Could not read your clients: ${(error as Error).message}`,
      warnings,
      sheetReadAt: roster.sheetReadAt,
    };
  }

  let statesTracked = true;
  let stored: StoredMonthRow[] = [];
  try {
    stored = await fetchAllRows<StoredMonthRow>(
      (from, to) =>
        supabase
          .from("monthly_reports")
          .select("client_id,status,sent_via,updated_at")
          .eq("month", monthStartDate(month))
          .order("client_id")
          .range(from, to),
      "monthly_reports",
    );
  } catch (error) {
    if (!isMissingMonthlyTable(error as { message?: string })) {
      return {
        month,
        ...empty,
        statesTracked: false,
        error: `Could not read this month's report states: ${(error as Error).message}`,
        warnings,
        sheetReadAt: roster.sheetReadAt,
      };
    }
    statesTracked = false;
    warnings.push(`Report states can't be saved yet: run ${MONTHLY_REPORTS_MIGRATION} in Supabase.`);
  }

  return {
    month,
    ...buildMonthlyList({ month, entries: roster.entries, visibleClients, stored, isAdmin }),
    statesTracked,
    error: null,
    warnings,
    sheetReadAt: roster.sheetReadAt,
  };
}
