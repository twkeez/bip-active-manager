import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/types/client";
import { ALLOWED_RADIUS_MILES } from "@/lib/local-rank/constants";
import { localRankZoneAllowance } from "@/lib/playbook/client-tiers";

type NewZone = {
  kind?: "zip" | "radius";
  zip?: string | null;
  radiusMiles?: number | null;
};

function parseClientId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function loadZoneAllowance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: number,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("seo")
    .eq("id", clientId)
    .maybeSingle<Pick<ClientRow, "seo">>();
  if (error || !data) return null;
  return localRankZoneAllowance({ seo: data.seo } as ClientRow);
}

async function listZones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  clientId: number,
) {
  return supabase
    .from("client_rank_zones")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = parseClientId(url.searchParams.get("clientId"));
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  const { data, error } = await listZones(supabase, user.id, clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allowance = await loadZoneAllowance(supabase, clientId);
  return NextResponse.json({ zones: data ?? [], allowance: allowance ?? 0 });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { clientId?: number; add?: NewZone; deleteId?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = parseClientId(body.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  if (body.deleteId && Number.isInteger(body.deleteId)) {
    const { error } = await supabase
      .from("client_rank_zones")
      .delete()
      .eq("owner_user_id", user.id)
      .eq("client_id", clientId)
      .eq("id", body.deleteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.add) {
    const allowance = await loadZoneAllowance(supabase, clientId);
    if (allowance === null) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const { count } = await supabase
      .from("client_rank_zones")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id)
      .eq("client_id", clientId);
    if ((count ?? 0) + 1 > allowance) {
      const message =
        allowance === 0
          ? "Local rank tracking isn't included in this tier."
          : `This tier allows ${allowance} zone${allowance === 1 ? "" : "s"}.`;
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const kind = body.add.kind;
    if (kind === "zip") {
      const zip = (body.add.zip ?? "").trim();
      if (!zip) return NextResponse.json({ error: "A ZIP code is required." }, { status: 400 });
      const { error } = await supabase.from("client_rank_zones").insert({
        owner_user_id: user.id,
        client_id: clientId,
        kind: "zip",
        zip,
        radius_miles: null,
        label: zip,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (kind === "radius") {
      const miles = Number(body.add.radiusMiles);
      const radiusMiles = ALLOWED_RADIUS_MILES.includes(miles as (typeof ALLOWED_RADIUS_MILES)[number])
        ? miles
        : ALLOWED_RADIUS_MILES[1];
      const { error } = await supabase.from("client_rank_zones").insert({
        owner_user_id: user.id,
        client_id: clientId,
        kind: "radius",
        zip: null,
        radius_miles: radiusMiles,
        label: `${radiusMiles} mi around practice`,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Zone kind must be 'zip' or 'radius'." }, { status: 400 });
    }
  }

  const { data, error } = await listZones(supabase, user.id, clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const allowance = await loadZoneAllowance(supabase, clientId);
  return NextResponse.json({ zones: data ?? [], allowance: allowance ?? 0 });
}
