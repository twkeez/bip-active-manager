import { redirect } from "next/navigation";
import AdsHealthView from "@/components/ads/ads-health-view";
import { loadConversionIntegrityData } from "@/lib/dashboard/load-conversion-integrity-data";
import { loadGlobalAdsOptimizationData } from "@/lib/dashboard/load-global-ads-optimization-data";
import { loadPpcDefenseData } from "@/lib/dashboard/load-ppc-defense-data";
import { createClient } from "@/lib/supabase/server";

// One glance across the ads radars. Composes the three existing detectors'
// summaries — the detail still lives in each radar, linked from here.
export default async function AdsHealthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [global, defense, conversion] = await Promise.all([
    loadGlobalAdsOptimizationData(supabase),
    loadPpcDefenseData(supabase),
    loadConversionIntegrityData(supabase),
  ]);

  const lastSyncAt =
    [global.lastAdsSyncAt, defense.lastAdsSyncAt, conversion.lastAdsSyncAt]
      .filter((v): v is string => !!v)
      .sort()
      .at(-1) ?? null;
  const loadError = global.loadError ?? defense.loadError ?? conversion.loadError ?? null;

  return (
    <AdsHealthView
      global={global.summary}
      defense={defense.summary}
      conversion={conversion.summary}
      lastSyncAt={lastSyncAt}
      loadError={loadError}
    />
  );
}
