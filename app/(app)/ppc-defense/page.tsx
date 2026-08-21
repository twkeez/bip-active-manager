import { redirect } from "next/navigation";
import PpcDefenseRadar from "@/components/dashboard/ppc-defense-radar";
import { loadPpcDefenseData } from "@/lib/dashboard/load-ppc-defense-data";
import { createClient } from "@/lib/supabase/server";
import { resolveFocusClient } from "@/lib/dashboard/focus-client";
export default async function PpcDefensePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const data = await loadPpcDefenseData(supabase);
  const focusClient = await resolveFocusClient(supabase, searchParams);
  return (
    <PpcDefenseRadar
      lpDeficits={data.lpDeficits}
      budgetHogs={data.budgetHogs}
      summary={data.summary}
      lastAdsSyncAt={data.lastAdsSyncAt}
      userEmail={user.email}
      loadError={data.loadError}
      focusClient={focusClient}
    />
  );
}
