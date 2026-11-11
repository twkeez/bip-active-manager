import { notFound, redirect } from "next/navigation";
import AuditReport, { type Audience, type PreviousRun } from "@/components/website-audit/audit-report";
import ReportPrintShell from "@/components/website-audit/report-print-shell";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { practiceMatchProblems } from "@/lib/website-audit/practice-match";
import type { WebsiteAuditRow } from "@/lib/website-audit/types";

export const dynamic = "force-dynamic";

// The branded audit report, to save as a PDF. Lives outside the (app) route
// group so it prints without the sidebar. The report renders on the server, so
// the crawl's page text never reaches the browser.
export default async function WebsiteAuditPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ for?: string }> }) {
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
  // A re-run within the same day isn't a "last time" worth comparing with
  // (nothing on the site has changed), so look at least 20 hours back.
  const before = new Date(new Date(audit.created_at).getTime() - 20 * 60 * 60 * 1000).toISOString();
  const { data: earlier, error } = await admin
    .from("website_audits")
    .select("id, created_at, results")
    .eq("domain", audit.domain)
    .lt("created_at", before)
    .not("score", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Couldn't look up the last run: ${error.message}`);
  const previous = (earlier?.[0] as PreviousRun | undefined) ?? null;

  // Written for a client (we look after their site) or a prospect (someone else does).
  // An audit started from a client record is a client's; ?for= switches it.
  const asked = (await searchParams).for;
  const audience: Audience = asked === "client" || asked === "prospect" || asked === "team" ? asked : audit.client_id != null ? "client" : "prospect";

  return (
    <ReportPrintShell
      title={audience === "team" ? `${audit.practice_name} · Team worklist · Beyond Indigo Pets` : `${audit.practice_name} · Website, SEO & AI Search Audit · Beyond Indigo Pets`}
      warnings={practiceMatchProblems(audit, audit.results).map((p) => p.detail)}
      versions={{
        current: audience,
        links: (["client", "prospect", "team"] as const).map((v) => ({ key: v, label: v === "team" ? "Team worklist" : `${v === "client" ? "Client" : "Prospect"} report`, href: `/website-audit-print/${audit.id}?for=${v}` })),
      }}
    >
      <AuditReport audit={audit} previous={previous} audience={audience} />
    </ReportPrintShell>
  );
}
