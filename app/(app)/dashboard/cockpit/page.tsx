import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientWorkspaceData } from "@/lib/dashboard/load-client-workspace-data";
import type { ClientRow } from "@/lib/types/client";
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

  return (
    <CockpitSandbox
      clients={clients}
      selectedId={selectedId}
      workspace={workspace}
    />
  );
}
