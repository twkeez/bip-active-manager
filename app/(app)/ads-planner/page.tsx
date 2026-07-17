import { redirect } from "next/navigation";
import AdsPlannerView from "@/components/ads/ads-planner-view";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export default async function AdsPlannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) redirect("/dashboard");

  return <AdsPlannerView />;
}
