import { NextResponse } from "next/server";
import { requireSignedIn } from "@/lib/auth/guard";
import { rejectUnlessClientVisible } from "@/lib/reporting/client-access";
import {
  isMissingMonthlyTable,
  isMonthKey,
  isStoredState,
  monthStartDate,
  MONTHLY_REPORTS_MIGRATION,
  parseReportMonth,
  parseSentVia,
} from "@/lib/reporting/monthly";
import { loadMonthSummary, summaryBlocksProgress } from "@/lib/reporting/month-summary";

type Params = Promise<{ clientId: string }>;

/**
 * Moves one client's report for one month to Draft, Reviewed or Sent.
 *
 * Body: { month: "YYYY-MM", status: "draft" | "reviewed" | "sent", sentVia?: [...] }
 *
 * Saved with the caller's own session, so the table's rule applies on top of
 * the check here: only someone who can see the client can change its report.
 */
export async function POST(req: Request, context: { params: Params }) {
  const { clientId } = await context.params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
  }

  const auth = await requireSignedIn();
  if ("response" in auth) return auth.response;
  const { supabase, profile } = auth;

  const denied = await rejectUnlessClientVisible(supabase, id);
  if (denied) return denied;

  let body: { month?: unknown; status?: unknown; sentVia?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // A month in the future, or not a month at all, is refused rather than
  // quietly swapped for another month.
  if (!isMonthKey(body.month) || parseReportMonth(body.month) !== body.month) {
    return NextResponse.json({ error: "month must be a past or current month, written YYYY-MM." }, { status: 400 });
  }
  if (!isStoredState(body.status)) {
    return NextResponse.json({ error: "status must be draft, reviewed or sent." }, { status: 400 });
  }
  const sentVia = body.status === "sent" ? parseSentVia(body.sentVia) : [];
  if (body.status === "sent" && sentVia.length === 0) {
    return NextResponse.json({ error: "Say how the report was sent." }, { status: 400 });
  }

  // Nothing AI-drafted or unreviewed may ride along: the summary has to be
  // approved (or cleared) before the report is Reviewed or Sent.
  if (body.status !== "draft") {
    const loaded = await loadMonthSummary(supabase, id, body.month);
    if (!loaded.available && !loaded.missing) {
      return NextResponse.json({ error: loaded.error }, { status: 500 });
    }
    const blocked = summaryBlocksProgress(loaded.summary, body.month);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });
  }

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    client_id: id,
    month: monthStartDate(body.month),
    status: body.status,
    sent_via: sentVia,
    updated_at: now,
    updated_by: profile.id,
  };
  if (body.status === "reviewed") Object.assign(row, { reviewed_at: now, reviewed_by: profile.id });
  if (body.status === "sent") Object.assign(row, { sent_at: now, sent_by: profile.id });

  const { data, error } = await supabase
    .from("monthly_reports")
    .upsert(row, { onConflict: "client_id,month" })
    .select("client_id,month,status,sent_via,updated_at,reviewed_at,sent_at")
    .single();
  if (error) {
    if (isMissingMonthlyTable(error)) {
      return NextResponse.json(
        { error: `Report states can't be saved yet: run ${MONTHLY_REPORTS_MIGRATION} in Supabase first.` },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: `Could not save the report's state: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ report: data });
}
