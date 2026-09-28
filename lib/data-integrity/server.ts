import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleConfig } from "@/lib/env";
import { detectTruncatedRead, type TruncatedRead } from "./row-cap";

/**
 * Server half of the row-cap tripwire.
 *
 * guardedFetch wraps every server-side Supabase request (see
 * lib/supabase/server.ts and admin.ts). A read that came back at the cap is
 * recorded in data_warnings, and added to the current integrity scope, so a
 * report or briefing export can refuse to go out over it.
 */

type Scope = { truncated: TruncatedRead[] };
const scopeStore = new AsyncLocalStorage<Scope>();

/**
 * Run `fn` and collect every capped read made inside it. Used around client
 * report and briefing loaders: anything in `truncated` means the output may be
 * missing data and must not be exported.
 */
export async function withIntegrityScope<T>(fn: () => Promise<T>): Promise<{ result: T; truncated: TruncatedRead[] }> {
  const scope: Scope = { truncated: [] };
  const result = await scopeStore.run(scope, fn);
  return { result, truncated: scope.truncated };
}

// Records with plain fetch, so recording a warning can never trigger itself.
function recorderClient() {
  const { url, key } = getSupabaseServiceRoleConfig();
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Record (or re-open and count) a warning. Never throws: a warning must not break the page. */
export async function recordTruncatedRead(read: TruncatedRead): Promise<void> {
  try {
    const db = recorderClient();
    const now = new Date().toISOString();
    const { data: existing } = await db
      .from("data_warnings")
      .select("id, occurrences")
      .eq("problem_key", read.problemKey)
      .maybeSingle<{ id: number; occurrences: number }>();
    if (existing) {
      await db
        .from("data_warnings")
        .update({ occurrences: existing.occurrences + 1, last_seen_at: now, resolved_at: null, detail: read.detail, rows_returned: read.rows })
        .eq("id", existing.id);
    } else {
      await db.from("data_warnings").insert({
        problem_key: read.problemKey,
        kind: "row_cap",
        table_name: read.table,
        detail: read.detail,
        rows_returned: read.rows,
      });
    }
  } catch (error) {
    console.error("[data-warning] could not record a capped read:", read.detail, error);
  }
  console.warn(`[data-warning] ${read.detail}`);
}

/** fetch for Supabase clients: passes everything through, notes capped reads. */
export const guardedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
  const read = detectTruncatedRead(url, method, response.headers.get("content-range"));
  if (read) {
    scopeStore.getStore()?.truncated.push(read);
    await recordTruncatedRead(read);
  }
  return response;
};
