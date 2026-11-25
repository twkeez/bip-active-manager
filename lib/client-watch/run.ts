import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRosterReport } from "@/lib/basecamp/load-roster-report";
import { shapeRow } from "@/lib/basecamp/response-report";
import { runWithConcurrency } from "@/lib/basecamp/concurrency";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { loadSheetRoster } from "@/lib/basecamp/sheet-roster";
import { CLIENT_WATCH_MODEL, readClient } from "./read";
import {
  BASECAMP_STATUS_LABEL,
  CLIENT_WATCH_MIGRATION,
  CLIENT_WATCH_PROMPT_VERSION,
  basecampStatusOf,
  isMissingTableError,
  newestActivityOf,
  planReads,
  type WatchRead,
} from "./shape";

/**
 * The Client Watch refresh: reads every Master Sheet client whose Basecamp
 * has changed since its last read (shape.ts planReads), a few at a time, and
 * stops starting new ones once the time budget is used. Whatever is left is
 * picked up by the next run. A failed read is recorded, shown on the page
 * and retried next run.
 */

/** Reads at once. Each is one Claude request; four keeps a run well inside its time. */
const CONCURRENCY = 4;

export type RefreshSummary = {
  rosterClients: number;
  due: number;
  read: number;
  unchanged: number;
  leftForNextRun: number;
  costUsd: number;
  failed: Array<{ client: string; error: string }>;
};

export async function runClientWatchRefresh(
  admin: SupabaseClient,
  options: { startedAt?: number; budgetMs: number; onlyClientId?: number },
): Promise<RefreshSummary> {
  const startedAt = options.startedAt ?? Date.now();
  const report = await loadRosterReport(admin);
  if (report.loadError) throw new Error(`The Response Report could not be read: ${report.loadError}`);
  if (!report.rosterApplied) {
    // Never read from the wrong list of clients.
    throw new Error(`The Master Sheet roster could not be applied: ${report.roster.error ?? "unknown reason"}`);
  }

  const attempts = await fetchAllRows<Pick<WatchRead, "client_id" | "newest_post_at" | "prompt_version" | "model" | "error">>(
    (from, to) =>
      admin
        .from("client_watch_last_attempt")
        .select("id,client_id,newest_post_at,prompt_version,model,error")
        .order("client_id")
        .order("id")
        .range(from, to),
    "Client Watch reads",
  ).catch((error: Error) => {
    if (isMissingTableError(error.message)) throw new Error(`Client Watch is not set up yet: run ${CLIENT_WATCH_MIGRATION}.`);
    throw error;
  });

  // The sheet's package value, for the read's context.
  const roster = await loadSheetRoster(admin);
  const packageByClient = new Map<number, string | null>();
  for (const entry of roster.entries) if (entry.clientId != null) packageByClient.set(entry.clientId, entry.packageValue ?? null);

  // One entry per client: two practices on one project are still two clients.
  const byClient = new Map<number, (typeof report.rows)[number]>();
  for (const row of report.rows) if (row.client_id != null && !byClient.has(row.client_id)) byClient.set(row.client_id, row);
  if (options.onlyClientId != null && !byClient.has(options.onlyClientId)) {
    throw new Error("That client isn't on the Master Sheet roster with a Package, so Client Watch doesn't read it.");
  }

  const plan = planReads({
    clients: [...byClient.values()]
      .filter((row) => options.onlyClientId == null || row.client_id === options.onlyClientId)
      .map((row) => ({ clientId: row.client_id!, name: row.account_name, newestPostAt: newestActivityOf(row) })),
    lastAttempts: new Map(attempts.map((a) => [a.client_id, a])),
    model: CLIENT_WATCH_MODEL,
    promptVersion: CLIENT_WATCH_PROMPT_VERSION,
    force: options.onlyClientId != null ? new Set([options.onlyClientId]) : undefined,
  });

  const summary: RefreshSummary = {
    rosterClients: byClient.size,
    due: plan.due.length,
    read: 0,
    unchanged: plan.unchanged,
    leftForNextRun: 0,
    costUsd: 0,
    failed: [],
  };

  await runWithConcurrency(plan.due, CONCURRENCY, async (planned) => {
    if (Date.now() - startedAt > options.budgetMs) {
      summary.leftForNextRun += 1;
      return;
    }
    const row = byClient.get(planned.clientId)!;
    const result = await readClient(
      admin,
      {
        clientId: planned.clientId,
        name: row.account_name,
        strategist: row.marketing_strategist,
        packageValue: packageByClient.get(planned.clientId) ?? null,
        basecampStatus: BASECAMP_STATUS_LABEL[basecampStatusOf(shapeRow(row))],
      },
      planned.newestPostAt,
    );
    summary.costUsd += result.cost_usd ?? 0;
    const { error } = await admin.from("client_watch_reads").insert(result);
    if (error) {
      summary.failed.push({ client: row.account_name, error: `Couldn't save the read: ${error.message}` });
      return;
    }
    if (result.error) summary.failed.push({ client: row.account_name, error: result.error });
    else summary.read += 1;
  });

  summary.costUsd = Math.round(summary.costUsd * 10_000) / 10_000;
  return summary;
}
