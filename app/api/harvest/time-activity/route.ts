import { NextResponse } from "next/server";
import { getHarvestConfig } from "@/lib/env";
import { fetchHarvestTimeActivityReport } from "@/lib/harvest/time-activity";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/types/client";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const harvestConfig = getHarvestConfig();
  if (!harvestConfig) {
    return NextResponse.json(
      {
        error:
          "Harvest is not configured. Set HARVEST_ACCESS_TOKEN and HARVEST_ACCOUNT_ID in .env.local (Personal Access Token + account ID from Harvest).",
      },
      { status: 400 },
    );
  }

  const { data: clientsRaw, error } = await supabase
    .from("clients")
    .select("*")
    .order("account_name", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const report = await fetchHarvestTimeActivityReport(
      harvestConfig,
      (clientsRaw ?? []) as ClientRow[],
    );
    return NextResponse.json({ ok: true, report });
  } catch (fetchError) {
    const message =
      fetchError instanceof Error
        ? fetchError.message
        : "Failed to fetch Harvest time activity.";
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
