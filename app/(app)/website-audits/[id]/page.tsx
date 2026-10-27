import { notFound, redirect } from "next/navigation";
import WebsiteAuditView from "@/components/website-audit/audit-view";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { WebsiteAuditRow } from "@/lib/website-audit/types";

export const dynamic = "force-dynamic";

export default async function WebsiteAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(await getProfile(supabase))) redirect("/");

  const { id } = await params;
  const { data } = await createAdminClient().from("website_audits").select("*").eq("id", Number(id)).maybeSingle();
  if (!data) notFound();
  const audit = data as WebsiteAuditRow;
  // Page text is for the content pass, not the screen: keep the payload small.
  if (audit.results.technical) {
    audit.results.technical = {
      ...audit.results.technical,
      pages: audit.results.technical.pages.map((p) => ({ ...p, text: "", navLinks: [] })),
    };
  }
  return <WebsiteAuditView audit={audit} />;
}
