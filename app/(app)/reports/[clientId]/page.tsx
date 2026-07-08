import { notFound, redirect } from "next/navigation";
import ClientReportWorkspace from "@/components/reports/client-report-workspace";
import { createClient } from "@/lib/supabase/server";
import type { ReportDraft } from "@/lib/reporting/draft-types";
import { loadReportForClient } from "@/lib/reporting/load-report";

type Params = Promise<{ clientId: string }>;
type SearchParams = Promise<{ range?: string; back?: string }>;

export default async function ReportClientPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { clientId } = await params;
  const { range, back } = await searchParams;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const loaded = await loadReportForClient(supabase, user.id, id, range);
  if (!loaded) notFound();
  const { report, config: layoutConfig, managedKeywords, workspace } = loaded;

  const { data: draftRow } = await supabase
    .from("report_drafts")
    .select("*")
    .eq("client_id", id)
    .maybeSingle();
  const draft: ReportDraft | null = draftRow ?? null;

  const syncTimestamps = {
    gsc: workspace.gscSnapshot?.updated_at ?? null,
    ads: workspace.adsSnapshot?.updated_at ?? null,
    ga4: workspace.ga4Snapshot?.updated_at ?? null,
    social: workspace.socialDailySnapshots[0]?.created_at ?? null,
    gbp: workspace.gbpSnapshot?.updated_at ?? null,
  };

  const backHref = back === "cockpit" ? `/dashboard/cockpit?client=${id}` : null;

  return (
    <ClientReportWorkspace
      report={report}
      clientId={id}
      initialConfig={layoutConfig}
      initialDraft={draft}
      initialKeywords={managedKeywords}
      syncTimestamps={syncTimestamps}
      backHref={backHref}
    />
  );
}
