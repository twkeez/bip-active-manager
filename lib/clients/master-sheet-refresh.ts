import type { SupabaseClient } from "@supabase/supabase-js";
import { duplicatePracticeNames, parseMasterSheetRows, type MasterSheetRow } from "@/lib/clients/master-sheet";
import { fetchMasterSheetRows } from "@/lib/google/master-sheet-source";

/**
 * Replaces the stored copy of the Master Sheet (master_sheet_practices).
 *
 * Shared by the "refresh" button and the daily job, so both apply the same
 * guards. Replaces every row rather than merging: a practice dropping off the
 * sheet is information, and a merge would keep it alive forever.
 */

/** Fewer practices than this looks like a partial read; nothing is replaced. */
export const MIN_PRACTICES = 25;

export class MasterSheetRefreshError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function replaceMasterSheet(
  admin: SupabaseClient,
  rows: MasterSheetRow[],
  importedBy: string | null,
): Promise<number> {
  if (rows.length === 0) {
    throw new MasterSheetRefreshError(
      "No practices found. The sheet needs a header row with a 'Practice Name' column.",
      400,
    );
  }
  if (rows.length < MIN_PRACTICES) {
    throw new MasterSheetRefreshError(
      `Only ${rows.length} practices found, which looks like a partial read. Nothing was replaced.`,
      400,
    );
  }

  const { error: clearError } = await admin.from("master_sheet_practices").delete().gte("id", 0);
  if (clearError) throw new MasterSheetRefreshError(clearError.message, 500);

  const payload = rows.map((row) => ({
    practice_name: row.practiceName,
    normalized_name: row.normalizedName,
    url: row.url,
    city: row.city,
    state: row.state,
    package_value: row.packageValue,
    strategist: row.strategist,
    imported_by: importedBy,
  }));
  for (let i = 0; i < payload.length; i += 250) {
    const { error } = await admin.from("master_sheet_practices").insert(payload.slice(i, i + 250));
    if (error) {
      throw new MasterSheetRefreshError(
        `The stored copy of the sheet is now incomplete (${i} of ${payload.length} practices saved): ${error.message}. Refresh again.`,
        500,
      );
    }
  }
  return payload.length;
}

/** Reads the sheet from Drive and replaces the stored copy. */
export async function refreshMasterSheetFromDrive(
  admin: SupabaseClient,
  importedBy: string | null,
): Promise<{ imported: number; duplicates: string[] }> {
  let grid: string[][];
  try {
    grid = await fetchMasterSheetRows();
  } catch (error) {
    throw new MasterSheetRefreshError(
      error instanceof Error ? error.message : "Could not read the master sheet.",
      502,
    );
  }
  const imported = await replaceMasterSheet(admin, parseMasterSheetRows(grid), importedBy);
  // Two rows with the same name are stored once; say which, never drop quietly.
  return { imported, duplicates: duplicatePracticeNames(grid) };
}
