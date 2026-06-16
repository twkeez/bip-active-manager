import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteAuditManager from "@/components/site-audit/site-audit-manager";
import type { WebsiteAuditRun } from "@/lib/site-audit/types";
export default async function SiteAuditPage() {
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
  return (
    <SiteAuditManager
      initialRuns={(data ?? []) as WebsiteAuditRun[]}
      userEmail={user.email}
    />
  );
}
