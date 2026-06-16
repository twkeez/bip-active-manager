import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_TIER_FALLBACKS,
  fetchServiceTiers,
  sortTiers,
  type ServiceTierTemplate,
} from "@/lib/strategy-mapper/tier-library";

function rowFromTemplate(tier: ServiceTierTemplate) {
  return {
    tier_key: tier.tierKey,
    service: tier.service,
    tier_label: tier.tierLabel,
    tier_rank: tier.tierRank,
    title: tier.title,
    objective: tier.objective,
    tactics: tier.tactics,
    match_aliases: tier.matchAliases,
    enabled: tier.enabled,
    updated_at: new Date().toISOString(),
  };
}

function templateFromRow(row: Record<string, unknown>): ServiceTierTemplate {
  return {
    id: row.id as number | undefined,
    tierKey: row.tier_key as string,
    service: row.service as ServiceTierTemplate["service"],
    tierLabel: row.tier_label as string,
    tierRank: row.tier_rank as number,
    title: row.title as string,
    objective: row.objective as string,
    tactics: (row.tactics as string[]) ?? [],
    matchAliases: (row.match_aliases as string[]) ?? [],
    enabled: row.enabled as boolean,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tiers = await fetchServiceTiers(supabase);
  return NextResponse.json({ tiers });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ServiceTierTemplate;
  try {
    body = (await request.json()) as ServiceTierTemplate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.tierKey?.trim() || !body.service || !body.tierLabel?.trim()) {
    return NextResponse.json({ error: "tierKey, service, and tierLabel are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("strategy_mapper_service_tiers")
    .upsert(rowFromTemplate(body), { onConflict: "tier_key" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tiers = await fetchServiceTiers(supabase);
  return NextResponse.json({ tier: templateFromRow(data), tiers });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tierKey = searchParams.get("tierKey");
  if (!tierKey) {
    return NextResponse.json({ error: "tierKey query param is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("strategy_mapper_service_tiers")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("tier_key", tierKey);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tiers = await fetchServiceTiers(supabase);
  return NextResponse.json({ tiers });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action: string | undefined;
  try {
    const body = (await request.json()) as { action?: string };
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (action !== "reset-defaults") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const rows = DEFAULT_TIER_FALLBACKS.map((tier) => ({
    ...rowFromTemplate({ ...tier, enabled: true }),
  }));

  const { error } = await supabase
    .from("strategy_mapper_service_tiers")
    .upsert(rows, { onConflict: "tier_key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tiers = sortTiers(
    (await supabase.from("strategy_mapper_service_tiers").select("*")).data?.map(
      templateFromRow,
    ) ?? DEFAULT_TIER_FALLBACKS,
  );

  return NextResponse.json({ tiers });
}
