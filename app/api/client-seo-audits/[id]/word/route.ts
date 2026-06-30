import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseAuditRunId } from "@/lib/site-audit/shared";
import { renderSeoAuditWord, seoAuditWordFilename } from "@/lib/site-audit/seo-audit-word";
import type { ClientSeoAudit } from "@/lib/site-audit/seo-audit-types";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await context.params;
  const id = parseAuditRunId(idRaw);
  if (!id) return NextResponse.json({ error: "Invalid audit id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: audit, error } = await supabase
    .from("client_seo_audits")
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .maybeSingle<ClientSeoAudit>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!audit) return NextResponse.json({ error: "Audit not found" }, { status: 404 });

  const html = renderSeoAuditWord(audit.template_json);
  const filename = seoAuditWordFilename(audit.template_json);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
