import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_REPORT_CONFIG, type ReportConfig } from "@/lib/reporting/report-config-types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("report_template_config")
    .select("config")
    .eq("key", "master")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data?.config ?? DEFAULT_REPORT_CONFIG });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { config?: ReportConfig };
  try {
    body = (await request.json()) as { config?: ReportConfig };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.config?.sections) {
    return NextResponse.json({ error: "config.sections is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("report_template_config")
    .upsert({ key: "master", config: body.config, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
