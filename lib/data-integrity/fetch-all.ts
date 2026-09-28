// Read every row of a query, in pages, instead of the first 1000.
//
// The database stops at 1000 rows per request without saying so. This asks
// for rows 0–499, then 500–999, and so on until a short page comes back.
// Pages are 500 so the helper's own requests never sit at the cap and set off
// the row-cap tripwire (lib/data-integrity/row-cap.ts).
//
// The query MUST have a deterministic order (end with a unique column such as
// id), or rows can shift between pages and be skipped or repeated.

export const PAGE_SIZE = 500;
/** 500,000 rows. Past this, stop loudly rather than run away. */
const MAX_PAGES = 1000;

// Loose on purpose: Supabase infers its own row type, and the caller names T.
type PageResult = { data: unknown; error: { message: string } | null };

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult>,
  label = "query",
): Promise<T[]> {
  const rows: T[] = [];
  for (let index = 0; index < MAX_PAGES; index += 1) {
    const from = index * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const batch = (Array.isArray(data) ? data : []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new Error(`${label}: more than ${MAX_PAGES * PAGE_SIZE} rows; narrow the query.`);
}
