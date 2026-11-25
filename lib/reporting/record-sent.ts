import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMissingMonthlyTable,
  monthLabel,
  monthStartDate,
  MONTHLY_REPORTS_MIGRATION,
  parseSentVia,
  type MonthKey,
  type SentVia,
} from "@/lib/reporting/monthly";

type StoredRow = {
  status: string;
  sent_via: string[] | null;
  sent_at: string | null;
  sent_by: string | null;
};

/**
 * The row to save when a report goes out by `via`. Keeps every earlier way it
 * was sent, and keeps the first sent time and sender when it was already sent,
 * so a second email doesn't move the date the client first got it.
 */
export function sentRow(
  clientId: number,
  month: MonthKey,
  via: SentVia,
  existing: StoredRow | null,
  userId: string,
  now: string,
): Record<string, unknown> {
  const wasSent = existing?.status === "sent";
  return {
    client_id: clientId,
    month: monthStartDate(month),
    status: "sent",
    sent_via: parseSentVia([...(existing?.sent_via ?? []), via]),
    updated_at: now,
    updated_by: userId,
    sent_at: wasSent && existing?.sent_at ? existing.sent_at : now,
    sent_by: wasSent && existing?.sent_by ? existing.sent_by : userId,
  };
}

export type RecordSentResult = { month: MonthKey; recorded: true } | { month: MonthKey; recorded: false; error: string };

/**
 * Marks a client's report for `month` as sent by `via`. Called after the send
 * itself has succeeded, so it never throws: a failure comes back as a reason
 * for the caller to show, because the report did go out either way.
 *
 * `admin` is the service-key client; the caller has already checked who may send.
 */
export async function recordReportSent(
  admin: SupabaseClient,
  clientId: number,
  month: MonthKey,
  via: SentVia,
  userId: string,
): Promise<RecordSentResult> {
  const label = monthLabel(month);
  const fail = (message: string): RecordSentResult => ({
    month,
    recorded: false,
    error: `${label}'s report couldn't be marked as sent on Monthly reports: ${message}`,
  });
  try {
    const { data, error: readError } = await admin
      .from("monthly_reports")
      .select("status,sent_via,sent_at,sent_by")
      .eq("client_id", clientId)
      .eq("month", monthStartDate(month))
      .maybeSingle();
    if (readError) {
      return fail(isMissingMonthlyTable(readError) ? `run ${MONTHLY_REPORTS_MIGRATION} in Supabase first.` : readError.message);
    }
    const row = sentRow(clientId, month, via, (data as StoredRow | null) ?? null, userId, new Date().toISOString());
    const { error } = await admin.from("monthly_reports").upsert(row, { onConflict: "client_id,month" });
    if (error) {
      return fail(isMissingMonthlyTable(error) ? `run ${MONTHLY_REPORTS_MIGRATION} in Supabase first.` : error.message);
    }
    return { month, recorded: true };
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
