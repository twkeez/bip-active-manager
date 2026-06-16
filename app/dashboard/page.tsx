import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ControlPanel from "@/components/dashboard/control-panel";
import { fetchBasecampSyncState } from "@/lib/dashboard/snapshot-queries";
import { redirectLegacyClientQuery } from "@/lib/dashboard/redirect-legacy-client-query";
import { fetchPriorityTasks } from "@/lib/tasks/priority-tasks";
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ basecamp?: string; clientId?: string; tab?: string }>;
}) {
  const params = await searchParams;
  redirectLegacyClientQuery(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { count: clientCount } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true });
  const syncStateRaw = await fetchBasecampSyncState(supabase);
  const priorityTasks = user
    ? await fetchPriorityTasks(supabase, user.id).catch(() => [])
    : [];
  return (
    <ControlPanel
      userEmail={user?.email}
      clientCount={clientCount ?? 0}
      syncState={syncStateRaw}
      basecampStatus={params.basecamp}
      priorityTasks={priorityTasks}
    />
  );
}
