import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportRecommendationItem } from "@/lib/reporting/types";
import { isMissingMonthlyTable, monthLabel, monthStartDate, type MonthKey } from "@/lib/reporting/monthly";

/**
 * The strategist's summary and next steps for one client's report for one
 * month, kept on its monthly_reports row.
 *
 * The rule Tom set: nothing AI-written goes to a client until a strategist has
 * reviewed it. So a summary is either a draft or approved. Saving any text
 * makes it a draft again; only the explicit Approve action sets approved. The
 * PDF, Word export and report preview use clientSummary(), which returns
 * nothing for a draft, and the report can't move to Reviewed or Sent while a
 * draft waits (summaryBlocksProgress(), and the table's own check).
 */

export const MONTH_SUMMARY_MIGRATION = "supabase/migrations/20261125210000_monthly_report_summary.sql";

export const SUMMARY_MAX_LENGTH = 4000;
export const RECOMMENDATION_MAX_LENGTH = 400;
export const RECOMMENDATIONS_MAX = 8;

const PRIORITIES = ["high", "medium", "low"] as const;

export type MonthSummary = {
  summary: string;
  recommendations: ReportRecommendationItem[];
  aiDrafted: boolean;
  updatedAt: string | null;
  approvedAt: string | null;
};

export type StoredSummaryRow = {
  summary: string | null;
  recommendations: unknown;
  summary_ai_drafted: boolean | null;
  summary_updated_at: string | null;
  summary_approved_at: string | null;
};

export const SUMMARY_COLUMNS =
  "summary,recommendations,summary_ai_drafted,summary_updated_at,summary_approved_at";

/** Keeps only well-formed next steps: a known priority and some text, trimmed. */
export function parseRecommendations(value: unknown): ReportRecommendationItem[] {
  if (!Array.isArray(value)) return [];
  const out: ReportRecommendationItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { priority, text } = item as { priority?: unknown; text?: unknown };
    if (typeof text !== "string" || !text.trim()) continue;
    const p = PRIORITIES.includes(priority as (typeof PRIORITIES)[number])
      ? (priority as ReportRecommendationItem["priority"])
      : "medium";
    out.push({ priority: p, text: text.trim() });
  }
  return out;
}

export function toMonthSummary(row: StoredSummaryRow | null | undefined): MonthSummary {
  return {
    summary: row?.summary ?? "",
    recommendations: parseRecommendations(row?.recommendations),
    aiDrafted: row?.summary_ai_drafted ?? false,
    updatedAt: row?.summary_updated_at ?? null,
    approvedAt: row?.summary_approved_at ?? null,
  };
}

export function hasSummaryContent(s: Pick<MonthSummary, "summary" | "recommendations">): boolean {
  return s.summary.trim() !== "" || s.recommendations.length > 0;
}

/**
 * What may go in front of the client: the approved summary and next steps, or
 * null when there's nothing approved. A draft never comes back from here.
 */
export function clientSummary(s: MonthSummary | null): { summary: string; recommendations: ReportRecommendationItem[] } | null {
  if (!s || !s.approvedAt || !hasSummaryContent(s)) return null;
  return { summary: s.summary.trim(), recommendations: s.recommendations };
}

/** Why the report can't move to Reviewed or Sent yet, or null when it can. */
export function summaryBlocksProgress(s: MonthSummary | null, month: MonthKey): string | null {
  if (!s || s.approvedAt || !hasSummaryContent(s)) return null;
  return `${monthLabel(month)}'s summary and next steps haven't been approved. Approve them on the report's Summary tab, or clear them, first.`;
}

/** Checks text sent from the editor. Returns the cleaned values or a reason. */
export function validateSummaryInput(body: {
  summary?: unknown;
  recommendations?: unknown;
}): { summary: string; recommendations: ReportRecommendationItem[] } | { error: string } {
  if (body.summary != null && typeof body.summary !== "string") return { error: "summary must be text." };
  const summary = (body.summary ?? "").trim();
  if (summary.length > SUMMARY_MAX_LENGTH) {
    return { error: `The summary is ${summary.length} characters; keep it under ${SUMMARY_MAX_LENGTH}.` };
  }
  if (body.recommendations != null && !Array.isArray(body.recommendations)) {
    return { error: "recommendations must be a list." };
  }
  const recommendations = parseRecommendations(body.recommendations);
  if (recommendations.length > RECOMMENDATIONS_MAX) {
    return { error: `Keep it to ${RECOMMENDATIONS_MAX} next steps or fewer.` };
  }
  const long = recommendations.find((r) => r.text.length > RECOMMENDATION_MAX_LENGTH);
  if (long) return { error: `Each next step must be under ${RECOMMENDATION_MAX_LENGTH} characters.` };
  return { summary, recommendations };
}

/** True when the summary columns aren't there yet (the migration hasn't run). */
export function isMissingSummaryColumns(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /(summary|recommendations)/.test(error.message ?? "") && /does not exist|could not find/i.test(error.message ?? "");
}

export type LoadedMonthSummary =
  /** Columns exist: `summary` is this month's (empty when nothing is saved). */
  | { available: true; summary: MonthSummary; error: null }
  /** `missing`: the migration hasn't run, so no summary can exist. Otherwise the read failed. */
  | { available: false; missing: boolean; summary: null; error: string };

export async function loadMonthSummary(
  supabase: SupabaseClient,
  clientId: number,
  month: MonthKey,
): Promise<LoadedMonthSummary> {
  const { data, error } = await supabase
    .from("monthly_reports")
    .select(SUMMARY_COLUMNS)
    .eq("client_id", clientId)
    .eq("month", monthStartDate(month))
    .maybeSingle();
  if (error) {
    if (isMissingSummaryColumns(error)) {
      return { available: false, missing: true, summary: null, error: `Run ${MONTH_SUMMARY_MIGRATION} in Supabase to save summaries.` };
    }
    if (isMissingMonthlyTable(error)) {
      return { available: false, missing: true, summary: null, error: "Monthly reports aren't set up in the database yet." };
    }
    return { available: false, missing: false, summary: null, error: `The summary couldn't be read: ${error.message}` };
  }
  return { available: true, summary: toMonthSummary(data as StoredSummaryRow | null), error: null };
}
