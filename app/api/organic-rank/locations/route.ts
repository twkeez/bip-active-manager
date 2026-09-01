import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function parseClientId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function listLocations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  clientId: number,
) {
  return supabase
    .from("client_organic_locations")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = parseClientId(new URL(request.url).searchParams.get("clientId"));
  if (!clientId) return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });

  const { data, error } = await listLocations(supabase, user.id, clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ locations: data ?? [] });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { clientId?: number; add?: { zip?: string }; deleteId?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const clientId = parseClientId(body.clientId);
  if (!clientId) return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });

  if (body.deleteId && Number.isInteger(body.deleteId)) {
    const { error } = await supabase
      .from("client_organic_locations")
      .delete()
      .eq("client_id", clientId)
      .eq("id", body.deleteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.add) {
    const zip = (body.add.zip ?? "").trim();
    if (!zip) return NextResponse.json({ error: "A ZIP code is required." }, { status: 400 });
    const { error } = await supabase.from("client_organic_locations").insert({
      created_by: user.id,
      client_id: clientId,
      zip,
      label: zip,
    });
    // Ignore duplicate-key (already tracking that ZIP).
    if (error && !/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data, error } = await listLocations(supabase, user.id, clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ locations: data ?? [] });
}
