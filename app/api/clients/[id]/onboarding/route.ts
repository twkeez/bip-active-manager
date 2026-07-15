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

  const { data: intake } = await supabase
    .from("client_onboarding_intake")
    .select("discovery, discovery_at, kickoff_meeting_at, competitor_ads")
    .eq("client_id", clientId)
    .maybeSingle();

  return NextResponse.json({
    evaluation,
    clientProfile: {
      marketing_strategist: client.marketing_strategist,
      tier: client.tier,
      seo: client.seo,
      ppc: client.ppc,
      smm: client.smm,
      blog: client.blog,
      orm: client.orm,
    },
    discovery: intake?.discovery ?? null,
    discoveryAt: intake?.discovery_at ?? null,
    kickoffMeetingAt: intake?.kickoff_meeting_at ?? null,
    competitorAds: intake?.competitor_ads ?? null,
  });
}
