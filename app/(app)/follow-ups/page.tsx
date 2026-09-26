import { redirect } from "next/navigation";
import FollowupsView from "@/components/followups/followups-view";
import { loadFollowups } from "@/lib/followups/load";
import { createClient } from "@/lib/supabase/server";

export default async function FollowupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { open, done, loadError } = await loadFollowups(supabase);
  return <FollowupsView open={open} done={done} loadError={loadError} />;
}
