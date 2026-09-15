import type { SupabaseClient } from "@supabase/supabase-js";
import type { Canary, CanaryItem, CanaryStatus } from "./canaries";
import { runCanaryQuery, RUN_ROW_LIMIT, type QueryRow } from "./readonly-query";

/**
 * Canaries somebody wrote, rather than canaries somebody shipped.
 *
 * Everything here turns a stored row plus a query result into exactly the same
 * Canary shape the built-in checks produce, so the board cannot tell them apart
 * and nothing downstream needs to care where a canary came from.
 */

export type CustomCanaryRow = {
  id: number;
  key: string;
  name: string;
  watches: string;
  instruction: string;
  query_sql: string;
  headline_none: string;
  headline_some: string;
  item_label_column: string;
  item_meta_columns: string[] | null;
  href_template: string | null;
  severity: "attention" | "overdue";
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_finding_count: number | null;
  last_error: string | null;
};

/** More than this on one card is a report, not a canary. */
export const MAX_ITEMS_SHOWN = 40;

function labelForColumn(column: string): string {
  return column.replace(/_/g, " ").replace(/\bid\b/i, "ID");
}

/** Numbers that are really floats read badly at full precision on a card. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }
  return String(value);
}

function fillTemplate(template: string, row: QueryRow): string | null {
  let out = template;
  for (const [key, value] of Object.entries(row)) {
    out = out.replaceAll(`{${key}}`, String(value ?? ""));
  }
  // A half-substituted link goes somewhere wrong, which is worse than no link.
  return /\{[a-z_]+\}/i.test(out) ? null : out;
}

export function buildCustomCanaryItems(
  canary: CustomCanaryRow,
  rows: QueryRow[],
): CanaryItem[] {
  const metaColumns = (canary.item_meta_columns ?? []).filter(
    (column) => column !== canary.item_label_column,
  );

  return rows.slice(0, MAX_ITEMS_SHOWN).map((row) => ({
    label: formatValue(row[canary.item_label_column]),
    meta: metaColumns
      .map((column) => `${labelForColumn(column)} ${formatValue(row[column])}`)
      .join(" · "),
    href: canary.href_template ? fillTemplate(canary.href_template, row) : null,
  }));
}

/**
 * The stored canary plus what its query returned, as a board card. Zero rows is
 * the all-clear: a canary reports good news by finding nothing.
 */
export function renderCustomCanary(canary: CustomCanaryRow, rows: QueryRow[]): Canary {
  const base = { key: `custom-${canary.key}`, name: canary.name, watches: canary.watches };

  if (rows.length === 0) {
    return {
      ...base,
      status: "ok",
      headline: canary.headline_none.replaceAll("{count}", "0"),
      detail: [],
    };
  }

  const count = String(rows.length);
  const detail: string[] = [];
  if (rows.length > MAX_ITEMS_SHOWN) {
    detail.push(`Showing the first ${MAX_ITEMS_SHOWN} of ${rows.length}.`);
  }
  if (rows.length >= RUN_ROW_LIMIT) {
    // The limit is applied in the database, so the real total is unknown.
    detail.push(`Stopped counting at ${RUN_ROW_LIMIT} — there may be more.`);
  }

  return {
    ...base,
    status: canary.severity as CanaryStatus,
    headline: canary.headline_some.replaceAll("{count}", count),
    detail,
    items: buildCustomCanaryItems(canary, rows),
  };
}

/** A canary whose query failed says so, rather than quietly reading as all clear. */
export function renderBrokenCanary(canary: CustomCanaryRow, message: string): Canary {
  return {
    key: `custom-${canary.key}`,
    name: canary.name,
    watches: canary.watches,
    status: "attention",
    headline: "This check could not run, so it is not watching anything right now.",
    detail: [message],
  };
}

type RunOutcome = {
  canary: Canary;
  status: "ok" | "attention" | "overdue" | "error";
  findingCount: number;
  error: string | null;
  durationMs: number;
  rows: QueryRow[];
};

async function runOne(admin: SupabaseClient, canary: CustomCanaryRow): Promise<RunOutcome> {
  const startedAt = Date.now();
  try {
    const rows = await runCanaryQuery(admin, canary.query_sql);
    const rendered = renderCustomCanary(canary, rows);
    return {
      canary: rendered,
      status: rendered.status,
      findingCount: rows.length,
      error: null,
      durationMs: Date.now() - startedAt,
      rows,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The query failed.";
    return {
      canary: renderBrokenCanary(canary, message),
      status: "error",
      findingCount: 0,
      error: message,
      durationMs: Date.now() - startedAt,
      rows: [],
    };
  }
}

/**
 * History is written only when something changed.
 *
 * These run on every page load, so recording each one would bury the three runs
 * that mattered under a thousand that did not. A row per *change* answers "when
 * did this start?" and "is it flapping?", which are the questions worth asking.
 */
async function recordRun(
  admin: SupabaseClient,
  canary: CustomCanaryRow,
  outcome: RunOutcome,
): Promise<void> {
  const changed =
    canary.last_status !== outcome.status ||
    (canary.last_finding_count ?? -1) !== outcome.findingCount;

  const now = new Date().toISOString();
  await admin
    .from("coal_mine_canaries")
    .update({
      last_run_at: now,
      last_status: outcome.status,
      last_finding_count: outcome.findingCount,
      last_error: outcome.error,
      updated_at: now,
    })
    .eq("id", canary.id);

  if (!changed) return;

  await admin.from("coal_mine_canary_runs").insert({
    canary_id: canary.id,
    status: outcome.status,
    finding_count: outcome.findingCount,
    headline: outcome.canary.headline,
    findings: outcome.rows.slice(0, MAX_ITEMS_SHOWN),
    error_message: outcome.error,
    duration_ms: outcome.durationMs,
  });
}

export async function listCustomCanaries(
  admin: SupabaseClient,
  { enabledOnly = true }: { enabledOnly?: boolean } = {},
): Promise<CustomCanaryRow[]> {
  let query = admin.from("coal_mine_canaries").select("*").order("created_at", { ascending: true });
  if (enabledOnly) query = query.eq("enabled", true);
  const { data, error } = await query.returns<CustomCanaryRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Every enabled canary, run together. A canary that throws becomes a broken
 * card rather than taking the board down with it — the built-in checks are
 * still worth seeing.
 */
export async function runCustomCanaries(admin: SupabaseClient): Promise<Canary[]> {
  let canaries: CustomCanaryRow[];
  try {
    canaries = await listCustomCanaries(admin);
  } catch {
    // The table may not exist yet on a deployment that has not had the
    // migration. That is not worth an error on the board.
    return [];
  }

  const outcomes = await Promise.all(canaries.map((canary) => runOne(admin, canary)));
  await Promise.all(
    outcomes.map((outcome, index) =>
      recordRun(admin, canaries[index], outcome).catch(() => {
        // Losing the history entry must not lose the finding.
      }),
    ),
  );
  return outcomes.map((outcome) => outcome.canary);
}
