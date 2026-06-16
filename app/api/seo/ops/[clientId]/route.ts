import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildSeoOpsEvaluation } from "@/lib/seo/ops/load";
import { buildPage2Opportunities } from "@/lib/seo/page2-opportunities";
import { buildRankFluctuations } from "@/lib/seo/rank-fluctuations";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const params = await context.params;
  const clientId = parseClientId(params.clientId ?? "");
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

  const { data: clientRaw, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }
  if (!clientRaw) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const evaluation = await buildSeoOpsEvaluation(supabase, clientRaw as ClientRow);
  return NextResponse.json({ evaluation });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const params = await context.params;
  const clientId = parseClientId(params.clientId ?? "");
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

  let body: {
    keywordHealthRows?: import("@/lib/types/client").KeywordHealthRow[];
    keywordHealthRefreshedAt?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data: clientRaw, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }
  if (!clientRaw) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const evaluation = await buildSeoOpsEvaluation(supabase, clientRaw as ClientRow, {
    keywordHealthRows: body.keywordHealthRows ?? [],
    keywordHealthRefreshedAt: body.keywordHealthRefreshedAt ?? null,
  });

  const gscQuery = await supabase
    .from("client_gsc_query_metrics")
    .select("query, impressions, clicks, position")
    .eq("client_id", clientId)
    .order("impressions", { ascending: false })
    .limit(250);

  const keywordTargetsQuery = await supabase
    .from("client_keyword_targets")
    .select("keyword, is_active")
    .eq("client_id", clientId)
    .eq("is_active", true);

  const page2Opportunities = buildPage2Opportunities(gscQuery.data ?? []);
  const rankFluctuations = buildRankFluctuations(
    body.keywordHealthRows ?? [],
    keywordTargetsQuery.data ?? [],
    5,
  );

  return NextResponse.json({
    evaluation,
    page2Opportunities,
    rankFluctuations,
  });
}
