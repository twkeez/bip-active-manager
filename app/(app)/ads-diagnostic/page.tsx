import { redirect } from "next/navigation";
import AdsDiagnosticView from "@/components/ads/ads-diagnostic-view";
import { isSyncableAdsCustomerId } from "@/lib/ads/customer-id";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/types/client";

export default async function AdsDiagnosticPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) redirect("/dashboard");

  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("id, account_name, ads_customer_id")
    .order("account_name", { ascending: true });

  const clients = ((clientsRaw ?? []) as Pick<ClientRow, "id" | "account_name" | "ads_customer_id">[])
    .filter((c) => isSyncableAdsCustomerId(c.ads_customer_id))
    .map((c) => ({ name: c.account_name ?? "Unnamed", customerId: c.ads_customer_id as string }));

  return <AdsDiagnosticView clients={clients} />;
}
