import { redirect } from "next/navigation";
import ResponseReportView from "@/components/basecamp/response-report-view";
import { loadResponseReport } from "@/lib/basecamp/load-response-report";
import { createClient } from "@/lib/supabase/server";

export default async function ResponseReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { rows, ignored, lastSyncedAt, loadError } = await loadResponseReport(supabase);

  return <ResponseReportView
      rows={rows}
      ignored={ignored}
      lastSyncedAt={lastSyncedAt}
      loadError={loadError}
    />;
}
