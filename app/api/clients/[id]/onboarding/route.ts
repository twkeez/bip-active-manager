import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildOnboardingEvaluations } from "@/lib/clients/onboarding";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const clientId = parseClientId(params.id);
  if (!clientId) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: clientRaw, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!clientRaw) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = clientRaw as ClientRow;
  const [evaluation] = await buildOnboardingEvaluations(supabase, user.id, [client]);
  return NextResponse.json({
    evaluation,
    clientProfile: {
      marketing_strategist: client.marketing_strategist,
      tier: client.tier,
      total_package_hours: client.total_package_hours,
      hours_for_strategist: client.hours_for_strategist,
    },
  });
}
