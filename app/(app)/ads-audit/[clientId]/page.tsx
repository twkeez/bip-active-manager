import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import AdsAuditReportView from "@/components/ads-audit/audit-report";
import AdsDiagnosticView from "@/components/ads/ads-diagnostic-view";
import { isSyncableAdsCustomerId, normalizeCustomerId } from "@/lib/ads/customer-id";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * One client's Google Ads deep-dive, in two tabs: the saved audit (history,
 * narrative, export; everyone) and the live diagnosis (fix list and drafted
 * changes; admins). These used to be two separate tools, /ads-audit and
 * /ads-diagnostic; /ads-diagnostic now sends a picked client here.
 */
export default async function AdsAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { clientId: clientIdRaw } = await params;
  const { tab } = await searchParams;
  const clientId = Number(clientIdRaw);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    notFound();
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id,account_name,ads_customer_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!clientRow) {
    notFound();
  }

  const admin = isAdmin(await getProfile(supabase));
  const customerId = isSyncableAdsCustomerId(clientRow.ads_customer_id)
    ? normalizeCustomerId(clientRow.ads_customer_id as string)
    : null;
  const canDiagnose = admin && customerId !== null;
  const showDiagnosis = canDiagnose && tab === "diagnosis";

  const tabClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition ${
      active ? "bg-bip-accent text-white" : "text-bip-muted hover:bg-bip-card hover:text-bip-text"
    }`;

  return (
    <div>
      {canDiagnose && (
        <nav className="mx-auto flex max-w-6xl gap-2 px-6 pt-6" aria-label="Ads audit views">
          <Link href={`/ads-audit/${clientId}`} className={tabClass(!showDiagnosis)}>
            Saved audit
          </Link>
          <Link href={`/ads-audit/${clientId}?tab=diagnosis`} className={tabClass(showDiagnosis)}>
            Live diagnosis
          </Link>
        </nav>
      )}
      {showDiagnosis ? (
        <AdsDiagnosticView
          clients={[]}
          lockedClient={{ name: clientRow.account_name, customerId: customerId!, clientId }}
          initialCustomerId={customerId!}
        />
      ) : (
        <AdsAuditReportView clientId={clientId} clientName={clientRow.account_name} />
      )}
    </div>
  );
}
