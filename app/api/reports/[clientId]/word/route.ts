import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadReportForClient } from "@/lib/reporting/load-report";
import { renderReportWord, reportWordFilename } from "@/lib/reporting/report-word";
import { stampReportRun } from "@/lib/reporting/stamp-report-run";

export async function GET(request: Request, context: { params: Promise<{ clientId: string }> }) {
  const { clientId: clientIdRaw } = await context.params;
  const clientId = Number(clientIdRaw);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const range = new URL(request.url).searchParams.get("range") ?? "last30";
  const loaded = await loadReportForClient(supabase, user.id, clientId, range);
  if (!loaded) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const html = renderReportWord(loaded.report, loaded.config);
  const filename = reportWordFilename(loaded.report);

  // A Word export is a report going out — record it for the client overview.
  await stampReportRun(clientId);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
