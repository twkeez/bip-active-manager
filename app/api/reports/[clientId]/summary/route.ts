import { NextResponse } from "next/server";
import { requireSignedIn } from "@/lib/auth/guard";
import { rejectUnlessClientVisible } from "@/lib/reporting/client-access";
import { isMissingMonthlyTable, isMonthKey, monthLabel, monthStartDate, parseReportMonth } from "@/lib/reporting/monthly";
import {
  isMissingSummaryColumns,
  MONTH_SUMMARY_MIGRATION,
  SUMMARY_COLUMNS,
  toMonthSummary,
  validateSummaryInput,
  type StoredSummaryRow,
} from "@/lib/reporting/month-summary";

type Params = Promise<{ clientId: string }>;

/**
 * Saves one client's summary and next steps for one month.
 *
 * Body: { month: "YYYY-MM", summary, recommendations: [{priority, text}],
 *         aiDrafted: boolean, approve: boolean }
 *
 * approve false saves a draft: it clears any earlier approval, so changed text
 * is never shown to the client until someone approves it again. approve true
 * saves the text and records the caller as approving it. Saved with the
 * caller's own session, so the table's rules apply too.
 */
export async function PUT(req: Request, context: { params: Params }) {
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

  let body: { month?: unknown; summary?: unknown; recommendations?: unknown; aiDrafted?: unknown; approve?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isMonthKey(body.month) || parseReportMonth(body.month) !== body.month) {
    return NextResponse.json({ error: "month must be a past or current month, written YYYY-MM." }, { status: 400 });
  }
  const month = body.month;
  const input = validateSummaryInput(body);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
  const approve = body.approve === true;
  const empty = input.summary === "" && input.recommendations.length === 0;

  const { data: existing, error: readError } = await supabase
    .from("monthly_reports")
    .select(`status,${SUMMARY_COLUMNS}`)
    .eq("client_id", id)
    .eq("month", monthStartDate(month))
    .maybeSingle();
  if (readError) return failure(readError);

  const status = (existing as { status?: string } | null)?.status ?? null;
  const label = monthLabel(month);
  if (status === "sent") {
    return NextResponse.json(
      { error: `${label}'s report is already marked Sent, so its summary can't be changed.` },
      { status: 409 },
    );
  }
  if (status === "reviewed" && !approve && !empty) {
    return NextResponse.json(
      {
        error: `${label}'s report is marked Reviewed, so changed text has to be approved to be saved. Press Save and approve, or move the report back to Draft.`,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    summary: input.summary || null,
    recommendations: input.recommendations,
    summary_ai_drafted: body.aiDrafted === true,
    summary_updated_at: now,
    summary_updated_by: profile.id,
    // Only an explicit approval sets these; any other save clears them.
    summary_approved_at: approve && !empty ? now : null,
    summary_approved_by: approve && !empty ? profile.id : null,
    updated_at: now,
    updated_by: profile.id,
  };

  const write = existing
    ? supabase
        .from("monthly_reports")
        .update(fields)
        .eq("client_id", id)
        .eq("month", monthStartDate(month))
        .select(SUMMARY_COLUMNS)
        .single()
    : // Writing the summary is the start of the month's report.
      supabase
        .from("monthly_reports")
        .insert({ client_id: id, month: monthStartDate(month), status: "draft", ...fields })
        .select(SUMMARY_COLUMNS)
        .single();
  const { data, error } = await write;
  if (error) return failure(error);
  return NextResponse.json({ summary: toMonthSummary(data as StoredSummaryRow), started: !existing });
}

function failure(error: { code?: string; message: string }) {
  if (isMissingSummaryColumns(error)) {
    return NextResponse.json(
      { error: `Summaries can't be saved yet: run ${MONTH_SUMMARY_MIGRATION} in Supabase first.` },
      { status: 503 },
    );
  }
  if (isMissingMonthlyTable(error)) {
    return NextResponse.json({ error: "Monthly reports aren't set up in the database yet." }, { status: 503 });
  }
  return NextResponse.json({ error: `Could not save the summary: ${error.message}` }, { status: 500 });
}
