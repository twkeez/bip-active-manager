import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SalesLabManager from "@/components/sales/sales-lab-manager";
import type {
  SalesProspectAiOutputs,
  SalesProspectAudit,
  SalesProspectRun,
} from "@/lib/types/client";
export default async function SalesLabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: runsRaw } = await supabase
    .from("sales_prospect_runs")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(25);
  const initialRuns = (runsRaw ?? []) as SalesProspectRun[];
  const firstRunId = initialRuns[0]?.id ?? null;
  let initialAudit: SalesProspectAudit | null = null;
  let initialAiOutputs: SalesProspectAiOutputs | null = null;
  if (firstRunId) {
    const [{ data: auditRaw }, { data: aiRaw }] = await Promise.all([
      supabase
        .from("sales_prospect_audits")
        .select("*")
        .eq("run_id", firstRunId)
        .maybeSingle(),
      supabase
        .from("sales_prospect_ai_outputs")
        .select("*")
        .eq("run_id", firstRunId)
        .maybeSingle(),
    ]);
    initialAudit = (auditRaw as SalesProspectAudit | null) ?? null;
    initialAiOutputs = (aiRaw as SalesProspectAiOutputs | null) ?? null;
  }
  return (
    <SalesLabManager
      initialRuns={initialRuns}
      initialSelectedRun={initialRuns[0] ?? null}
      initialSelectedAudit={initialAudit}
      initialSelectedAiOutputs={initialAiOutputs}
      userEmail={user.email}
    />
  );
}
