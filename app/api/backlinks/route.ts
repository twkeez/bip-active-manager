import { NextResponse } from "next/server";
import { fetchBacklinkSummary, fetchBacklinks } from "@/lib/dataforseo/backlinks";
import { getDataForSeoConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Every call spends DataForSEO credit (~2.4c per endpoint, so ~5c a lookup),
// which is why the UI only hits this on an explicit click rather than on mount.
export async function GET(request: Request) {
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

  const target = new URL(request.url).searchParams.get("target")?.trim() ?? "";
  if (!target) {
    return NextResponse.json({ error: "Missing target domain." }, { status: 400 });
  }

  try {
    const [summaryResult, rowsResult] = await Promise.all([
      fetchBacklinkSummary(config, target),
      fetchBacklinks(config, target),
    ]);

    if (!rowsResult.ok) {
      return NextResponse.json({ error: rowsResult.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      // A missing summary is survivable — the link list is the point, so the
      // page renders rows with empty totals rather than failing the lookup.
      summary: summaryResult.ok ? summaryResult.summary : null,
      rows: rowsResult.rows,
    });
  } catch (error) {
    console.error("Backlink lookup failed:", error);
    return NextResponse.json({ error: "Failed to load backlinks." }, { status: 500 });
  }
}
