import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_REPORT_CONFIG, type ReportConfig } from "@/lib/reporting/report-config-types";

function parseClientId(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = parseClientId(url.searchParams.get("clientId"));
  if (!clientId) return NextResponse.json({ error: "Valid clientId required" }, { status: 400 });

  // Try client-specific config first
  const { data: clientRow } = await supabase
    .from("client_report_configs")
    .select("config")
    .eq("client_id", clientId)
    .maybeSingle();

  if (clientRow?.config) {
    return NextResponse.json({ config: clientRow.config, source: "client" });
  }

  // Fall back to master template
  const { data: templateRow } = await supabase
    .from("report_template_config")
    .select("config")
    .eq("key", "master")
    .maybeSingle();

  return NextResponse.json({
    config: templateRow?.config ?? DEFAULT_REPORT_CONFIG,
    source: "template",
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { clientId?: number; config?: ReportConfig };
  try {
    body = (await request.json()) as { clientId?: number; config?: ReportConfig };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientId = parseClientId(body.clientId);
  if (!clientId) return NextResponse.json({ error: "Valid clientId required" }, { status: 400 });
  if (!body.config?.sections) return NextResponse.json({ error: "config.sections required" }, { status: 400 });

  const { error } = await supabase
    .from("client_report_configs")
    .upsert(
      { client_id: clientId, config: body.config, updated_at: new Date().toISOString() },
      { onConflict: "client_id" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
