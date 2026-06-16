import { redirect } from "next/navigation";
import GlobalAdsOptimizationCenter from "@/components/dashboard/global-ads-optimization-center";
import { loadGlobalAdsOptimizationData } from "@/lib/dashboard/load-global-ads-optimization-data";
import { createClient } from "@/lib/supabase/server";
export default async function GlobalAdsOptimizationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const data = await loadGlobalAdsOptimizationData(supabase);
  return (
    <GlobalAdsOptimizationCenter
      issues={data.issues}
      summary={data.summary}
      coverage={data.coverage}
      lastAdsSyncAt={data.lastAdsSyncAt}
      userEmail={user.email}
      loadError={data.loadError}
    />
  );
}
