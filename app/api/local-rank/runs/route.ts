import { NextResponse } from "next/server";
import { getDataForSeoConfig } from "@/lib/env";
import { runLocalRankGridScan } from "@/lib/local-rank/scan";
import { plannedApiCalls, normalizeGridSize, normalizeKeywords, normalizeRadiusMiles } from "@/lib/local-rank/validate";
import { createClient } from "@/lib/supabase/server";

function parseClientId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const clientId = parseClientId(url.searchParams.get("clientId"));
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("local_rank_grid_runs")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getDataForSeoConfig();
  if (!config) {
    return NextResponse.json(
      { error: "DataForSEO credentials are not configured on the server." },
      { status: 503 },
    );
  }

  let body: {
    clientId?: number;
    keywords?: string[];
    radiusMiles?: number;
    gridSize?: number;
    centerLat?: number;
    centerLng?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const clientId = parseClientId(body.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  let keywords: string[];
  let radiusMiles: number;
  let gridSize: number;
  try {
    keywords = normalizeKeywords(body.keywords ?? []);
    radiusMiles = normalizeRadiusMiles(body.radiusMiles);
    gridSize = normalizeGridSize(body.gridSize ?? 5);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid scan parameters." },
      { status: 400 },
    );
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, account_name, website, google_place_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const manualCenter =
    typeof body.centerLat === "number" && typeof body.centerLng === "number"
      ? { lat: body.centerLat, lng: body.centerLng, source: "manual" as const }
      : null;

  const apiCallsPlanned = plannedApiCalls(keywords.length, gridSize);

  const { data: runRow, error: insertError } = await supabase
    .from("local_rank_grid_runs")
    .insert({
      owner_user_id: user.id,
      client_id: clientId,
      status: "running",
      grid_size: gridSize,
      radius_miles: radiusMiles,
      center_lat: manualCenter?.lat ?? 0,
      center_lng: manualCenter?.lng ?? 0,
      business_name: client.account_name,
      matched_place_id: client.google_place_id,
      keywords,
      api_calls_planned: apiCallsPlanned,
      api_calls_completed: 0,
    })
    .select("*")
    .single();

  if (insertError || !runRow) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create grid run." },
      { status: 500 },
    );
  }

  try {
    const scan = await runLocalRankGridScan(config, {
      businessName: client.account_name,
      websiteUrl: client.website,
      googlePlaceId: client.google_place_id,
      keywords,
      radiusMiles,
      gridSize,
      manualCenter,
    });

    const cellRows = scan.cells.map((cell) => ({
      run_id: runRow.id,
      keyword: cell.keyword,
      row_idx: cell.cell.row,
      col_idx: cell.cell.col,
      lat: cell.cell.lat,
      lng: cell.cell.lng,
      label: cell.cell.label,
      rank: cell.rank,
      in_local_pack: cell.inLocalPack,
      matched_listing_title: cell.matchedListingTitle,
      matched_listing_domain: cell.matchedListingDomain,
      top_competitor_title: cell.topCompetitorTitle,
      pack_listings: cell.listings,
    }));

    const { error: cellsError } = await supabase.from("local_rank_grid_cells").insert(cellRows);
    if (cellsError) {
      throw new Error(cellsError.message);
    }

    const { data: completedRun, error: updateError } = await supabase
      .from("local_rank_grid_runs")
      .update({
        status: "complete",
        center_lat: scan.center.lat,
        center_lng: scan.center.lng,
        api_calls_completed: scan.apiCallsCompleted,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runRow.id)
      .eq("owner_user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { data: cells } = await supabase
      .from("local_rank_grid_cells")
      .select("*")
      .eq("run_id", runRow.id)
      .order("keyword")
      .order("row_idx")
      .order("col_idx");

    return NextResponse.json({
      run: completedRun,
      cells: cells ?? [],
    });
  } catch (error) {
    await supabase
      .from("local_rank_grid_runs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Grid scan failed.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runRow.id)
      .eq("owner_user_id", user.id);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Grid scan failed.",
        runId: runRow.id,
      },
      { status: 500 },
    );
  }
}
