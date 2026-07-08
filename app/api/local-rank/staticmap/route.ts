import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { LocalRankGridCellRow } from "@/lib/local-rank/types";

// Marker color per rank tier, matching the heat-map legend.
function tierColor(rank: number | null): string {
  if (rank == null) return "0x6b7280"; // grey — not in pack
  if (rank <= 3) return "0x10b981"; // green
  if (rank <= 10) return "0xf59e0b"; // amber
  return "0xef4444"; // red
}

function parseId(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// Proxies a Google Static Maps image (server-side key) with a colored dot at
// each grid point for the given run + keyword. Keeps GOOGLE_MAPS_API_KEY off
// the client.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const runId = parseId(url.searchParams.get("runId"));
  const keyword = (url.searchParams.get("keyword") ?? "").trim();
  if (!runId || !keyword) {
    return NextResponse.json({ error: "runId and keyword are required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Maps key not configured" }, { status: 503 });
  }

  // Owner-scoped: confirm the run belongs to this user, then load its cells.
  const { data: run } = await supabase
    .from("local_rank_grid_runs")
    .select("id")
    .eq("id", runId)
    .eq("owner_user_id", user.id)
    .maybeSingle<{ id: number }>();
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const { data: cells } = await supabase
    .from("local_rank_grid_cells")
    .select("lat, lng, rank, keyword")
    .eq("run_id", runId)
    .eq("keyword", keyword);
  const points = (cells ?? []) as Pick<LocalRankGridCellRow, "lat" | "lng" | "rank">[];
  if (points.length === 0) {
    return NextResponse.json({ error: "No points for this run/keyword" }, { status: 404 });
  }

  // Group points by tier color into one markers= param each.
  const byColor = new Map<string, string[]>();
  for (const p of points) {
    const color = tierColor(p.rank);
    const coord = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color)!.push(coord);
  }

  const params = new URLSearchParams();
  params.set("size", "600x600");
  params.set("scale", "2");
  params.set("maptype", "roadmap");
  params.set("key", apiKey);
  const markerParams = [...byColor.entries()].map(
    ([color, coords]) => `markers=color:${color}|size:small|${coords.join("|")}`,
  );
  const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&${markerParams.join("&")}`;

  const mapResponse = await fetch(staticUrl, { cache: "no-store" });
  if (!mapResponse.ok) {
    const body = await mapResponse.text();
    return NextResponse.json(
      { error: `Static Maps request failed (${mapResponse.status})`, detail: body.slice(0, 300) },
      { status: 502 },
    );
  }

  const image = await mapResponse.arrayBuffer();
  return new NextResponse(image, {
    status: 200,
    headers: {
      "Content-Type": mapResponse.headers.get("content-type") ?? "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
