import { NextResponse } from "next/server";
import { crawlCsv } from "@/lib/website-audit/csv";
import { requireAuditAdmin } from "@/lib/website-audit/access";
import type { WebsiteAuditRow } from "@/lib/website-audit/types";
import { createAdminClient } from "@/lib/supabase/admin";

/** The page-by-page crawl as a CSV download. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuditAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const { data } = await createAdminClient().from("website_audits").select("domain,created_at,results").eq("id", Number(id)).maybeSingle();
  const audit = data as Pick<WebsiteAuditRow, "domain" | "created_at" | "results"> | null;
  if (!audit?.results.technical) return NextResponse.json({ error: "No crawl yet" }, { status: 404 });
  return new NextResponse(crawlCsv(audit.results.technical), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${audit.domain}-crawl-${audit.created_at.slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
