import { NextResponse } from "next/server";
import {
  SNOOZE_DAYS,
  isActive,
  isFindingState,
  isFindingTool,
  type FindingStateRow,
} from "@/lib/ads/finding-states";
import { fetchAllRows } from "@/lib/data-integrity/fetch-all";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Saved decisions about ads findings (lib/ads/finding-states.ts).
 *
 * GET ?tool=…        the decisions still in force for that page
 * POST {tool, findingKey, clientId, state}   set one (snoozes end after SNOOZE_DAYS)
 * DELETE {tool, findingKey, state}           undo one
 */

async function signedInEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? (user.email ?? "") : null;
}

export async function GET(request: Request) {
  if ((await signedInEmail()) === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tool = new URL(request.url).searchParams.get("tool");
  if (!isFindingTool(tool)) return NextResponse.json({ error: "Unknown tool" }, { status: 400 });

  const admin = createAdminClient();
  try {
    const rows = await fetchAllRows<FindingStateRow & { id: number }>(
      (from, to) =>
        admin
          .from("ads_finding_states")
          .select("id,finding_key,client_id,state,snoozed_until,set_by,created_at")
          .eq("tool", tool)
          .order("id")
          .range(from, to),
      "ads_finding_states",
    );
    return NextResponse.json({ states: rows.filter((row) => isActive(row)) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load saved decisions" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const email = await signedInEmail();
  if (email === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    tool?: unknown;
    findingKey?: unknown;
    clientId?: unknown;
    state?: unknown;
  } | null;
  if (!body || !isFindingTool(body.tool) || !isFindingState(body.state) || typeof body.findingKey !== "string" || !body.findingKey) {
    return NextResponse.json({ error: "Missing tool, finding or state" }, { status: 400 });
  }
  const clientId = typeof body.clientId === "number" && Number.isInteger(body.clientId) ? body.clientId : null;
  const snoozedUntil =
    body.state === "snoozed" ? new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString() : null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ads_finding_states")
    .upsert(
      {
        tool: body.tool,
        finding_key: body.findingKey,
        client_id: clientId,
        state: body.state,
        snoozed_until: snoozedUntil,
        set_by: email || null,
        created_at: new Date().toISOString(),
      },
      { onConflict: "tool,finding_key,state" },
    )
    .select("finding_key,client_id,state,snoozed_until,set_by,created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ state: data });
}

export async function DELETE(request: Request) {
  if ((await signedInEmail()) === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { tool?: unknown; findingKey?: unknown; state?: unknown } | null;
  if (!body || !isFindingTool(body.tool) || !isFindingState(body.state) || typeof body.findingKey !== "string") {
    return NextResponse.json({ error: "Missing tool, finding or state" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("ads_finding_states")
    .delete()
    .eq("tool", body.tool)
    .eq("finding_key", body.findingKey)
    .eq("state", body.state);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
