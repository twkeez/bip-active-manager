import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientWorkspaceData } from "@/lib/dashboard/load-client-workspace-data";
import { getStrategistRoster } from "@/lib/team/strategist-roster";
import type { ClientRow } from "@/lib/types/client";
import type { ClientSeoAudit, ClientSeoAuditSchedule, ClientSeoAuditScheduleWithClient } from "@/lib/site-audit/seo-audit-types";
import { getClientTierKeys } from "@/lib/playbook/client-tiers";
import type { PlaybookItem } from "@/lib/playbook/types";
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

  // Playbook items for selected client's service tiers
  const tierKeys = workspace ? getClientTierKeys(workspace.client) : [];
  const { data: playbookRaw } = tierKeys.length > 0
    ? await supabase
        .from("playbook_items")
        .select("id, tier_key, category, type, title, body, auto_verify_key, sort_order, is_active, created_at, updated_at")
        .in("tier_key", tierKeys)
        .eq("is_active", true)
        .order("sort_order")
        .order("id")
    : { data: [] as PlaybookItem[] };
  const playbookItems = (playbookRaw ?? []) as PlaybookItem[];

  // SEO audit schedule + past audits for selected client
  let seoSchedule: ClientSeoAuditScheduleWithClient | null = null;
  let pastAudits: ClientSeoAudit[] = [];
  if (workspace && selectedId) {
    const [scheduleRes, auditsRes] = await Promise.all([
      supabase
        .from("client_seo_audit_schedules")
        .select("*")
        .eq("client_id", selectedId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("client_seo_audits")
        .select("*")
        .eq("client_id", selectedId)
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (scheduleRes.data) {
      seoSchedule = {
        ...(scheduleRes.data as ClientSeoAuditSchedule),
        account_name: workspace.client.account_name,
        marketing_strategist: workspace.client.marketing_strategist,
        website: workspace.client.website ?? null,
      };
    }
    pastAudits = (auditsRes.data ?? []) as ClientSeoAudit[];
  }

  const roster = getStrategistRoster();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <CockpitSandbox
      clients={clients}
      selectedId={selectedId}
      workspace={workspace}
      playbookItems={playbookItems}
      seoSchedule={seoSchedule}
      pastAudits={pastAudits}
      roster={roster}
      appUrl={appUrl}
    />
  );
}
