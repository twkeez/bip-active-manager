import { NextResponse } from "next/server";
import { requireAuditAdmin } from "@/lib/website-audit/access";
import { createAdminClient } from "@/lib/supabase/admin";

/** The whole audit as a JSON file. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuditAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const { data } = await createAdminClient().from("website_audits").select("*").eq("id", Number(id)).maybeSingle();
  if (!data) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.domain}-audit-${String(data.created_at).slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
