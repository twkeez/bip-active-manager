import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateAllClientSetup,
  filterSetupEvaluations,
} from "@/lib/clients/setup-status";
import type { ClientRow } from "@/lib/types/client";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter");
  const service = url.searchParams.get("service");
  const gap = url.searchParams.get("gap");

  const { data: clientsRaw, error: clientsError } = await supabase
    .from("clients")
    .select("*")
    .order("account_name", { ascending: true });

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }

  const clients = (clientsRaw ?? []) as ClientRow[];
  const clientIds = clients.map((client) => client.id);

  const { data: socialRaw } = clientIds.length
    ? await supabase
        .from("client_social_connections")
        .select("client_id")
        .in("client_id", clientIds)
        .eq("is_active", true)
    : { data: [] };

  const socialCountsByClientId: Record<number, number> = {};
  for (const row of socialRaw ?? []) {
    const clientId = Number((row as { client_id: number }).client_id);
    socialCountsByClientId[clientId] = (socialCountsByClientId[clientId] ?? 0) + 1;
  }

  const evaluations = evaluateAllClientSetup(clients, socialCountsByClientId);
  const filtered = filterSetupEvaluations(evaluations, { filter, service, gap });

  const summary = {
    total: evaluations.length,
    complete: evaluations.filter((row) => row.isComplete).length,
    missingRequired: evaluations.filter((row) => !row.isComplete).length,
    missingRecommended: evaluations.filter((row) => row.missingRecommended.length > 0)
      .length,
  };

  return NextResponse.json({ summary, clients: filtered });
}
