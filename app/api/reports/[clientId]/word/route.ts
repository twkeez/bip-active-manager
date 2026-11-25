import { exportBlockedMessage } from "@/components/data-integrity/export-blocked";
import { withIntegrityScope } from "@/lib/data-integrity/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadReportForClient } from "@/lib/reporting/load-report";
import { renderReportWord, reportWordFilename } from "@/lib/reporting/report-word";
import { stampReportRun } from "@/lib/reporting/stamp-report-run";
import { clientSummary, loadMonthSummary } from "@/lib/reporting/month-summary";
import { parseReportMonth } from "@/lib/reporting/monthly";

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
  const { result: loaded, truncated } = await withIntegrityScope(() =>
    loadReportForClient(supabase, user.id, clientId, range),
  );
  if (!loaded) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  // Never export numbers built on a read the database cut short.
  if (truncated.length) {
    return NextResponse.json({ error: exportBlockedMessage("report", truncated) }, { status: 409 });
  }

  // Only the month's approved summary and next steps go in. If they can't be
  // read, say so rather than export a report that silently leaves them out.
  const month = parseReportMonth(new URL(request.url).searchParams.get("month"));
  const summary = await loadMonthSummary(supabase, clientId, month);
  if (!summary.available && !summary.missing) {
    return NextResponse.json({ error: summary.error }, { status: 500 });
  }
  const html = renderReportWord(loaded.report, loaded.config, clientSummary(summary.summary));
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
