import { redirect } from "next/navigation";
import AdsCallsView from "@/components/ads/ads-calls-view";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { loadAdsCalls } from "@/lib/ads/load-ads-calls";
import { createClient } from "@/lib/supabase/server";

export default async function AdsCallsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) redirect("/dashboard");

  const data = await loadAdsCalls(supabase);
  return <AdsCallsView data={data} />;
}
