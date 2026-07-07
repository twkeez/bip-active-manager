import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientWorkspaceData } from "@/lib/dashboard/load-client-workspace-data";
import { getStrategistRoster } from "@/lib/team/strategist-roster";
import type { ClientRow } from "@/lib/types/client";
import type { ClientSeoAuditSchedule, ClientSeoAuditScheduleWithClient } from "@/lib/site-audit/seo-audit-types";
import CockpitSandbox from "@/components/dashboard/cockpit-sandbox";

type SearchParams = Promise<{ client?: string }>;

export default async function CockpitPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Client list for the dropdown
  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("id, account_name, marketing_strategist, tier")
    .order("account_name", { ascending: true });
  const clients = (clientsRaw ?? []) as Pick<
    ClientRow,
    "id" | "account_name" | "marketing_strategist" | "tier"
  >[];

  // Load workspace data if a client is selected
  const selectedId = query.client ? Number(query.client) : null;
  const workspace =
    selectedId && Number.isInteger(selectedId) && selectedId > 0
      ? await loadClientWorkspaceData(supabase, selectedId)
      : null;

  // SEO audit schedule for selected client
  let seoSchedule: ClientSeoAuditScheduleWithClient | null = null;
  if (workspace && selectedId) {
    const { data: scheduleRaw } = await supabase
      .from("client_seo_audit_schedules")
      .select("*")
      .eq("client_id", selectedId)
      .eq("is_active", true)
      .maybeSingle();
    if (scheduleRaw) {
      seoSchedule = {
        ...(scheduleRaw as ClientSeoAuditSchedule),
        account_name: workspace.client.account_name,
        marketing_strategist: workspace.client.marketing_strategist,
        website: workspace.client.website ?? null,
      };
    }
  }

  const roster = getStrategistRoster();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <CockpitSandbox
      clients={clients}
      selectedId={selectedId}
      workspace={workspace}
      seoSchedule={seoSchedule}
      roster={roster}
      appUrl={appUrl}
    />
  );
}
