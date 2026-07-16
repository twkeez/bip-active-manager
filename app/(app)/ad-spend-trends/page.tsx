import { redirect } from "next/navigation";
import AdSpendTrendsView from "@/components/ads/ad-spend-trends-view";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { loadSpendTrends } from "@/lib/ads/load-spend-trends";
import { createClient } from "@/lib/supabase/server";

export default async function AdSpendTrendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) redirect("/dashboard");

  const data = await loadSpendTrends(supabase);
  return <AdSpendTrendsView data={data} />;
}
