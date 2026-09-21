import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import { runCanaries } from "@/lib/coal-mines/canaries";
import { loadRoutineViews } from "@/lib/routines/load";
import { loadBriefableClients } from "@/lib/briefing/load";
import CoalMinesWorkspace from "@/components/coal-mines/coal-mines-workspace";

// Coal Mines: everything that watches, in one place. Routines run on a
// schedule and keep a history; canaries are evaluated here, on load. The admin
// client is for the canaries written here rather than shipped — their queries
// run through a function only the service role may call — and for routines,
// whose writes go through the service role.
export default async function CoalMinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [canaries, { routines, error }, clients] = await Promise.all([
    runCanaries(supabase, new Date(), admin),
    loadRoutineViews(admin),
    // For the client picker on routines that watch a chosen list.
    loadBriefableClients(admin),
  ]);

  return (
    // The selected item lives in the address; the Suspense boundary is what
    // Next asks for around a component that reads it.
    <Suspense fallback={null}>
      <CoalMinesWorkspace
        canaries={canaries}
        routines={routines}
        routinesError={error}
        clients={clients}
        checkedAt={new Date().toISOString()}
      />
    </Suspense>
  );
}
