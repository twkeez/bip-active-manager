// The database's silent row cap, and how a read that hit it is recognised.
//
// Supabase returns at most ROW_CAP rows per request and gives no error when a
// query had more (checked live 2026-09-28: asked for 5000 Basecamp rows, got
// 1000 of 5568). PostgREST reports what it returned in the Content-Range
// header, "0-999/*", so any read can be checked without looking at its body.
// Pure functions only: safe to import in the browser and on the server.

export const ROW_CAP = 1000;

/** Rows a PostgREST response returned, from its Content-Range header ("0-999/*"). */
export function rowsReturned(contentRange: string | null): number | null {
  const match = (contentRange ?? "").match(/^(\d+)-(\d+)\//);
  if (!match) return null;
  return Number(match[2]) - Number(match[1]) + 1;
}

export type TruncatedRead = {
  table: string;
  /** Stable per kind of query (table, columns, order): one warning each, not one per request. */
  problemKey: string;
  detail: string;
  rows: number;
};

/**
 * Whether a database read came back at the cap, and if so, what it was. Only
 * row reads (GET/HEAD against /rest/v1/<table>) count; RPC calls and writes do
 * not page this way.
 */
export function detectTruncatedRead(
  url: string,
  method: string | undefined,
  contentRange: string | null,
): TruncatedRead | null {
  if ((method ?? "GET").toUpperCase() !== "GET") return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const match = parsed.pathname.match(/\/rest\/v1\/([^/]+)$/);
  if (!match || match[1].startsWith("rpc")) return null;
  const rows = rowsReturned(contentRange);
  if (rows == null || rows < ROW_CAP) return null;
  const table = decodeURIComponent(match[1]);
  const select = parsed.searchParams.get("select") ?? "*";
  const order = parsed.searchParams.get("order") ?? "";
  const filters = [...parsed.searchParams.keys()].filter((k) => !["select", "order", "limit", "offset"].includes(k)).sort();
  return {
    table,
    problemKey: `row_cap|${table}|${select}|${order}|${filters.join(",")}`,
    detail: `A read of "${table}" (${select.slice(0, 120)}${order ? `, ordered by ${order}` : ""}${
      filters.length ? `, filtered on ${filters.join(", ")}` : ""
    }) returned exactly ${ROW_CAP} rows, the database's limit, so it was probably cut short.`,
    rows,
  };
}
