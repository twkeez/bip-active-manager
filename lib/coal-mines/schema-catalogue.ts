import type { SupabaseClient } from "@supabase/supabase-js";
import { runTrustedQuery } from "./readonly-query";

/**
 * The table list Claude writes canary queries against.
 *
 * Read live from the database rather than kept as a file, because a catalogue
 * that drifts from the schema produces queries that fail at run time with a
 * column that does not exist — and the person who typed the instruction has no
 * way to tell that from having asked for something impossible.
 */

/** Long Postgres type names carry no useful signal in a prompt. */
const TYPE_SHORTHAND: Record<string, string> = {
  "timestamp with time zone": "timestamptz",
  "timestamp without time zone": "timestamp",
  "character varying": "text",
  character: "text",
  "double precision": "float",
  numeric: "number",
  integer: "int",
  bigint: "int",
  smallint: "int",
  boolean: "bool",
  "ARRAY": "array",
  "USER-DEFINED": "enum",
};

/** Tables that are plumbing — nothing worth watching lives in them. */
const HIDDEN_TABLES = new Set([
  "basecamp_oauth_tokens",
  "integration_api_tokens",
  "coal_mine_canaries",
  "coal_mine_canary_runs",
]);

const CATALOGUE_SQL = `
  select
    c.table_name,
    string_agg(c.column_name || ' ' || c.data_type, ', ' order by c.ordinal_position) as columns
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
  group by c.table_name
  order by c.table_name
`;

let cached: { text: string; at: number } | null = null;
const CACHE_MS = 10 * 60 * 1000;

function shorten(columns: string): string {
  let out = columns;
  for (const [long, short] of Object.entries(TYPE_SHORTHAND)) {
    out = out.replaceAll(` ${long}`, ` ${short}`);
  }
  return out;
}

export async function loadSchemaCatalogue(
  admin: SupabaseClient,
  now: number = Date.now(),
): Promise<string> {
  if (cached && now - cached.at < CACHE_MS) return cached.text;

  const rows = await runTrustedQuery(admin, CATALOGUE_SQL, 1000);
  const text = rows
    .map((row) => ({
      table: String(row.table_name),
      columns: shorten(String(row.columns ?? "")),
    }))
    .filter((row) => !HIDDEN_TABLES.has(row.table))
    .map((row) => `${row.table}(${row.columns})`)
    .join("\n");

  cached = { text, at: now };
  return text;
}

/** Test seam — the catalogue is cached for ten minutes in a warm process. */
export function clearSchemaCatalogueCache() {
  cached = null;
}
