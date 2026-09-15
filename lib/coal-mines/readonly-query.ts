import type { SupabaseClient } from "@supabase/supabase-js";
import { assertReadOnlyQuery } from "./query-guard";

/**
 * Running a query a canary wrote.
 *
 * Everything goes through coal_mine_readonly_query, which runs in a read-only
 * transaction with a statement timeout — see the migration for why there are
 * three guards rather than one.
 */

export type QueryRow = Record<string, unknown>;

export const PREVIEW_ROW_LIMIT = 50;
export const RUN_ROW_LIMIT = 200;

/** For our own queries, which are not generated and not guarded. */
export async function runTrustedQuery(
  admin: SupabaseClient,
  sql: string,
  rowLimit = RUN_ROW_LIMIT,
): Promise<QueryRow[]> {
  const { data, error } = await admin.rpc("coal_mine_readonly_query", {
    query_text: sql,
    row_limit: rowLimit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as QueryRow[];
}

/** For a query a canary carries. Guarded before it reaches the database. */
export async function runCanaryQuery(
  admin: SupabaseClient,
  sql: string,
  rowLimit = RUN_ROW_LIMIT,
): Promise<QueryRow[]> {
  return runTrustedQuery(admin, assertReadOnlyQuery(sql), rowLimit);
}
