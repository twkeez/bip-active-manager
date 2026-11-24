import { NextResponse } from "next/server";
import { parseMasterSheet } from "@/lib/clients/master-sheet";
import { MasterSheetRefreshError, refreshMasterSheetFromDrive, replaceMasterSheet } from "@/lib/clients/master-sheet-refresh";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Refresh the master sheet.
 *
 * With no body it pulls the sheet straight from Drive, which is the normal
 * path — Tom edits the sheet, presses the button. A `csv` body still works as a
 * fallback for when Drive access is broken or the sheet has moved.
 *
 * Replaces every row rather than merging: the sheet is the source of truth, and
 * a practice dropping off it is information — merging would keep a stale row
 * alive forever and quietly turn a removed practice into a permanent "on the
 * sheet" answer.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { csv?: string };
  const csv = (body.csv ?? "").trim();

  const admin = createAdminClient();
  try {
    if (csv) {
      const imported = await replaceMasterSheet(admin, parseMasterSheet(csv), profile.email);
      return NextResponse.json({ ok: true, imported, source: "upload", duplicates: [] });
    }
    const { imported, duplicates } = await refreshMasterSheetFromDrive(admin, profile.email);
    return NextResponse.json({ ok: true, imported, source: "drive", duplicates });
  } catch (error) {
    const status = error instanceof MasterSheetRefreshError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not refresh the master sheet." },
      { status },
    );
  }
}
