import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteAuditManager from "@/components/site-audit/site-audit-manager";
import type { WebsiteAuditRun } from "@/lib/site-audit/types";

export default async function SiteAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data } = await supabase
    .from("website_audit_runs")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(25);

  // Arriving from a client workspace pre-fills that client's website, so nobody
  // has to retype a URL — and the header names the client the URL belongs to.
  const requested = Number((await searchParams).clientId);
  let forClient: { id: number; name: string; website: string | null } | null = null;
  if (Number.isInteger(requested) && requested > 0) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("id, account_name, website")
      .eq("id", requested)
      .maybeSingle();
    if (clientRow) {
      forClient = {
        id: clientRow.id as number,
        name: clientRow.account_name as string,
        website: (clientRow.website as string | null) ?? null,
      };
    }
  }

  return (
    <SiteAuditManager
      initialRuns={(data ?? []) as WebsiteAuditRun[]}
      userEmail={user.email}
      forClient={forClient}
    />
  );
}
