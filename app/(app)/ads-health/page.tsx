import { redirect } from "next/navigation";
import AdsHealthView, { type FlaggedAccount } from "@/components/ads/ads-health-view";
import { loadConversionIntegrityData } from "@/lib/dashboard/load-conversion-integrity-data";
import { loadGlobalAdsOptimizationData } from "@/lib/dashboard/load-global-ads-optimization-data";
import { loadPpcDefenseData } from "@/lib/dashboard/load-ppc-defense-data";
import { createClient } from "@/lib/supabase/server";

// One glance across the ads radars. Composes the three existing detectors —
// counts AND the flagged accounts (linked to each client) — with the detail
// still living in each radar.
type WithClient = { clientId: number; accountName: string };
function distinctAccounts(items: WithClient[]): FlaggedAccount[] {
  const seen = new Map<number, string>();
  for (const it of items) if (!seen.has(it.clientId)) seen.set(it.clientId, it.accountName);
  return [...seen.entries()].map(([clientId, name]) => ({ clientId, name }));
}

const QUALITY_TYPES = new Set(["ad_relevance", "expected_ctr", "low_quality_score"]);

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
      budgetCapped={distinctAccounts(global.issues.filter((i) => i.issueType === "budget_capped"))}
      budgetHogs={distinctAccounts(defense.budgetHogs)}
      qualityGlobal={distinctAccounts(global.issues.filter((i) => QUALITY_TYPES.has(i.issueType)))}
      landingPages={distinctAccounts(defense.lpDeficits)}
      conversion={distinctAccounts(conversion.anomalies)}
      accountsScanned={Math.max(defense.summary.accountsScanned, conversion.summary.accountsScanned)}
      lastSyncAt={lastSyncAt}
      loadError={loadError}
    />
  );
}
