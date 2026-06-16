import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdsAuditReportView from "@/components/ads-audit/audit-report";
export default async function AdsAuditPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId: clientIdRaw } = await params;
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
  return (
    <AdsAuditReportView
      clientId={clientId}
      clientName={clientRow.account_name}
    />
  );
}
