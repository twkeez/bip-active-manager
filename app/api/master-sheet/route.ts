import { NextResponse } from "next/server";
import { parseMasterSheet } from "@/lib/clients/master-sheet";
import { getProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Upload the master sheet as CSV.
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

  let csv: string;
  try {
    const body = (await request.json()) as { csv?: string };
    csv = body.csv ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!csv.trim()) {
    return NextResponse.json({ error: "No CSV content provided." }, { status: 400 });
  }

  const rows = parseMasterSheet(csv);
  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "No practices found. The file needs a header row with a 'Practice Name' column — export the Master tab as CSV.",
      },
      { status: 400 },
    );
  }

  // Guards against replacing a good sheet with a truncated export. The real
  // sheet carries a couple of hundred practices.
  if (rows.length < 25) {
    return NextResponse.json(
      {
        error: `Only ${rows.length} practices found, which looks like a partial export. Nothing was replaced.`,
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error: clearError } = await admin
    .from("master_sheet_practices")
    .delete()
    .gte("id", 0);
  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  const payload = rows.map((row) => ({
    practice_name: row.practiceName,
    normalized_name: row.normalizedName,
    url: row.url,
    city: row.city,
    state: row.state,
    package_value: row.packageValue,
    strategist: row.strategist,
    imported_by: profile.email,
  }));

  for (let i = 0; i < payload.length; i += 250) {
    const { error } = await admin
      .from("master_sheet_practices")
      .insert(payload.slice(i, i + 250));
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, imported: payload.length });
}
