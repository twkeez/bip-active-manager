import { notFound, redirect } from "next/navigation";
import AuditReport, { type PreviousRun } from "@/components/website-audit/audit-report";
import ReportPrintShell from "@/components/website-audit/report-print-shell";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { WebsiteAuditRow } from "@/lib/website-audit/types";

export const dynamic = "force-dynamic";

// The branded audit report, to save as a PDF. Lives outside the (app) route
// group so it prints without the sidebar. The report renders on the server, so
// the crawl's page text never reaches the browser.
export default async function WebsiteAuditPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(await getProfile(supabase))) redirect("/");

  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("website_audits").select("*").eq("id", Number(id)).maybeSingle();
  if (!data) notFound();
  const audit = data as WebsiteAuditRow;

  // "Today vs. last run": the newest earlier scored audit of the same domain.
  const { data: earlier, error } = await admin
    .from("website_audits")
    .select("id, created_at, results")
    .eq("domain", audit.domain)
    .lt("created_at", audit.created_at)
    .not("score", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Couldn't look up the last run: ${error.message}`);
  const previous = (earlier?.[0] as PreviousRun | undefined) ?? null;

  return (
    <ReportPrintShell title={`${audit.practice_name} · Website, SEO & AI Search Audit · Beyond Indigo Pets`}>
      <AuditReport audit={audit} previous={previous} />
    </ReportPrintShell>
  );
}
