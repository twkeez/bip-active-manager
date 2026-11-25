import ExportBlocked from "@/components/data-integrity/export-blocked";
import { searchConsoleNote } from "@/lib/seo/search-console-access";
import { withIntegrityScope } from "@/lib/data-integrity/server";
import { notFound, redirect } from "next/navigation";
import ClientReportWorkspace from "@/components/reports/client-report-workspace";
import { createClient } from "@/lib/supabase/server";
import type { ReportDraft } from "@/lib/reporting/draft-types";
import { loadReportForClient } from "@/lib/reporting/load-report";
import MonthStatusBar, { type MonthStatus } from "@/components/reporting/month-status-bar";
import {
  isMissingMonthlyTable,
  monthStartDate,
  parseReportMonth,
  parseSentVia,
  stateOf,
} from "@/lib/reporting/monthly";

type Params = Promise<{ clientId: string }>;
type SearchParams = Promise<{ range?: string; back?: string; month?: string }>;

export default async function ReportClientPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { clientId } = await params;
  const { range, back, month: requestedMonth } = await searchParams;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { result: loaded, truncated } = await withIntegrityScope(() =>
    loadReportForClient(supabase, user.id, id, range),
  );
  if (!loaded) notFound();
  const { report, config: layoutConfig, managedKeywords, workspace } = loaded;

  const { data: draftRow } = await supabase
    .from("report_drafts")
    .select("*")
    .eq("client_id", id)
    .maybeSingle();
  const draft: ReportDraft | null = draftRow ?? null;

  const syncTimestamps = {
    // A failed sync isn't a sync: show "never" and the not-connected note instead.
    gsc: workspace.gscSnapshot?.run_status === "failed" ? null : (workspace.gscSnapshot?.updated_at ?? null),
    ads: workspace.adsSnapshot?.updated_at ?? null,
    ga4: workspace.ga4Snapshot?.updated_at ?? null,
    social: workspace.socialDailySnapshots[0]?.created_at ?? null,
    gbp: workspace.gbpSnapshot?.updated_at ?? null,
  };

  // Where this client's report stands for the month (lib/reporting/monthly.ts).
  const month = parseReportMonth(requestedMonth);
  const { data: monthRow, error: monthError } = await supabase
    .from("monthly_reports")
    .select("status,sent_via,updated_at")
    .eq("client_id", id)
    .eq("month", monthStartDate(month))
    .maybeSingle();
  const monthTracked = !isMissingMonthlyTable(monthError);
  const monthProblem =
    monthError && monthTracked ? `This report's state could not be read: ${monthError.message}` : null;
  const monthStatus: MonthStatus = {
    state: stateOf(monthRow),
    sentVia: parseSentVia(monthRow?.sent_via),
    updatedAt: monthRow?.updated_at ?? null,
  };

  const backLink =
    back === "cockpit"
      ? { href: `/dashboard/cockpit?client=${id}`, label: "Back to cockpit" }
      : back === "reporting"
        ? { href: `/reporting?month=${month}`, label: "Back to Reporting" }
        : null;

  return (
    <>
      {truncated.length > 0 && <ExportBlocked what="report" truncated={truncated} variant="notice" />}
      <MonthStatusBar clientId={id} month={month} status={monthStatus} tracked={monthTracked} problem={monthProblem} />
      <ClientReportWorkspace
        report={report}
        clientId={id}
        initialConfig={layoutConfig}
        initialDraft={draft}
        initialKeywords={managedKeywords}
        syncTimestamps={syncTimestamps}
        syncNotes={{ gsc: searchConsoleNote(workspace.gscSnapshot) }}
        backHref={backLink?.href ?? null}
        backLabel={backLink?.label}
      />
    </>
  );
}
