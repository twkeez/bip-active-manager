import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ clientId: string }>;

export async function GET(_req: Request, context: { params: Params }) {
  const { clientId } = await context.params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("report_drafts")
    .select("*")
    .eq("client_id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data ?? null });
}

export async function PUT(req: Request, context: { params: Params }) {
  const { clientId } = await context.params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = {
    client_id: id,
    window_label: typeof body.window_label === "string" ? body.window_label : "Last 30 days",
    narrative: typeof body.narrative === "string" ? body.narrative : null,
    section_visibility: body.section_visibility ?? {},
    kpi_overrides: body.kpi_overrides ?? {},
    section_comments: body.section_comments ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("report_drafts")
    .upsert(payload, { onConflict: "client_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}
