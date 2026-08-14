import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadReportForClient } from "@/lib/reporting/load-report";
import ReportPrintClient from "@/components/reports/report-print-client";
import type { ReportDraft } from "@/lib/reporting/draft-types";
import { stampReportRun } from "@/lib/reporting/stamp-report-run";

// Bare, chrome-free print view of the report (no sidebar/controls) so the browser
// prints exactly the on-screen report. Lives outside the (app) route group.
export default async function ReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { clientId } = await params;
  const { range } = await searchParams;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const loaded = await loadReportForClient(supabase, user.id, id, range);
  if (!loaded) notFound();

  const { data: draftRow } = await supabase
    .from("report_drafts")
    .select("*")
    .eq("client_id", id)
    .maybeSingle();
  const draft: ReportDraft | null = draftRow ?? null;

  // This view exists only to be printed/saved as the client's PDF, so reaching
  // it counts as producing a report.
  await stampReportRun(id);

  return <ReportPrintClient report={loaded.report} config={loaded.config} draft={draft} />;
}
