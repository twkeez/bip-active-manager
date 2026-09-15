import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";
import { runCanaries } from "@/lib/coal-mines/canaries";
import CoalMinesBoard from "@/components/coal-mines/coal-mines-board";

// Coal Mines: the checks that watch for drift nobody is looking for. Runs the
// canaries on load for now — scheduling them is the next step, and none of them
// assume one. The admin client is for the canaries written here rather than
// shipped: their queries run through a function only the service role may call.
export default async function CoalMinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") redirect("/dashboard");

  const canaries = await runCanaries(supabase, new Date(), createAdminClient());

  return <CoalMinesBoard canaries={canaries} checkedAt={new Date().toISOString()} />;
}
