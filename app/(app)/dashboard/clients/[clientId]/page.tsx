import { notFound, redirect } from "next/navigation";
import ClientWorkspace from "@/components/dashboard/client-workspace";
import { loadClientWorkspaceData } from "@/lib/dashboard/load-client-workspace-data";
import { parseClientDetailTab } from "@/lib/dashboard/client-workspace-types";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { getStrategistRoster } from "@/lib/team/strategist-roster";
import type { BasecampSyncState } from "@/lib/types/client";
type Params = Promise<{ clientId: string }>;
type SearchParams = Promise<{ tab?: string }>;
export default async function ClientWorkspacePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { clientId: clientIdRaw } = await params;
  const query = await searchParams;
  const clientId = Number(clientIdRaw);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    notFound();
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const profile = await getProfile(supabase);
  const data = await loadClientWorkspaceData(supabase, clientId);
  if (!data) {
    notFound();
  }
  const { data: syncStateRaw } = await supabase
    .from("basecamp_sync_state")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const syncState = (syncStateRaw as BasecampSyncState | null) ?? null;
  const strategistRoster = getStrategistRoster();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return (
    <ClientWorkspace
      {...data}
      userEmail={user.email}
      syncState={syncState}
      initialTab={parseClientDetailTab(query.tab)}
      strategistRoster={strategistRoster}
      appUrl={appUrl}
      isAdminUser={isAdmin(profile)}
    />
  );
}
