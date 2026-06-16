import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { diffRoster, buildRosterDiffExportCsv } from "@/lib/clients/roster-diff";
import {
  parseRosterCsv,
  resolveRosterCsvInput,
} from "@/lib/clients/roster-import";
import type { ClientRow } from "@/lib/types/client";

type DiffBody = {
  sheetUrl?: string;
  csvText?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DiffBody;
  try {
    body = (await request.json()) as DiffBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const resolved = await resolveRosterCsvInput({
      sheetUrl: body.sheetUrl,
      csvText: body.csvText,
    });
    const sheetRows = parseRosterCsv(resolved.csvText);

    const { data: clientsRaw, error } = await supabase
      .from("clients")
      .select("*")
      .order("account_name", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = diffRoster((clientsRaw ?? []) as ClientRow[], sheetRows);
    const exportCsv = buildRosterDiffExportCsv(result);

    return NextResponse.json({
      ok: true,
      source: resolved.source,
      sheetRowCount: sheetRows.length,
      diff: {
        toAdd: result.toAdd.map((row) => ({
          rowIndex: row.rowIndex,
          accountName: row.accountName,
          record: row.record,
        })),
        toRemove: result.toRemove.map((client) => ({
          id: client.id,
          accountName: client.account_name,
        })),
        matched: result.matched.map((row) => ({
          id: row.client.id,
          accountName: row.client.account_name,
          sheetAccountName: row.sheetRow.accountName,
        })),
        ambiguous: result.ambiguous.map((row) => ({
          sheetAccountName: row.sheetRow.accountName,
          candidates: row.candidates.map((candidate) => ({
            id: candidate.client.id,
            accountName: candidate.client.account_name,
          })),
        })),
      },
      exportCsv,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to diff roster" },
      { status: 400 },
    );
  }
}
