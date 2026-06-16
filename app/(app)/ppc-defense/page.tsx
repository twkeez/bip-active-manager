import { redirect } from "next/navigation";
import PpcDefenseRadar from "@/components/dashboard/ppc-defense-radar";
import { loadPpcDefenseData } from "@/lib/dashboard/load-ppc-defense-data";
import { createClient } from "@/lib/supabase/server";
export default async function PpcDefensePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const data = await loadPpcDefenseData(supabase);
  return (
    <PpcDefenseRadar
      lpDeficits={data.lpDeficits}
      budgetHogs={data.budgetHogs}
      summary={data.summary}
      lastAdsSyncAt={data.lastAdsSyncAt}
      userEmail={user.email}
      loadError={data.loadError}
    />
  );
}
