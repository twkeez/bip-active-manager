import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runKeywordHealthComparison } from "@/lib/seo/search-console";
import type { KeywordHealthRow } from "@/lib/types/client";

type KeywordHealthRequestBody = {
  clientId?: number;
};

type KeywordAggregate = {
  keyword: string;
  page_url: string | null;
  position: number | null;
  clicks: number;
  impressions: number;
};

function aggregateKeywords(
  rows: Array<{
    query: string;
    page: string;
    clicks: number;
    impressions: number;
    position: number;
  }>,
) {
  const grouped = new Map<string, {
    weightedPositionNumerator: number;
    weightedPositionDenominator: number;
    clicks: number;
    impressions: number;
    topPage: string | null;
    topPageImpressions: number;
  }>();

  for (const row of rows) {
    const key = row.query.trim().toLowerCase();
    if (!key) continue;
    if (!grouped.has(key)) {
      grouped.set(key, {
        weightedPositionNumerator: 0,
        weightedPositionDenominator: 0,
        clicks: 0,
        impressions: 0,
        topPage: null,
        topPageImpressions: 0,
      });
    }
    const entry = grouped.get(key)!;
    const weight = Math.max(1, row.impressions);
    entry.weightedPositionNumerator += row.position * weight;
    entry.weightedPositionDenominator += weight;
    entry.clicks += row.clicks;
    entry.impressions += row.impressions;
    if (row.impressions >= entry.topPageImpressions) {
      entry.topPageImpressions = row.impressions;
      entry.topPage = row.page;
    }
  }

  const output = new Map<string, KeywordAggregate>();
  for (const [keyword, value] of grouped.entries()) {
    output.set(keyword, {
      keyword,
      page_url: value.topPage,
      position:
        value.weightedPositionDenominator > 0
          ? value.weightedPositionNumerator / value.weightedPositionDenominator
          : null,
      clicks: value.clicks,
      impressions: value.impressions,
    });
  }
  return output;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: KeywordHealthRequestBody;
  try {
    body = (await request.json()) as KeywordHealthRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("id,website,sc_url")
    .eq("id", clientId)
    .single<{ id: number; website: string | null; sc_url: string | null }>();

  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }

  try {
    const result = await runKeywordHealthComparison(
      clientRow.sc_url ?? "",
      clientRow.website ?? "",
    );
    const currentByKeyword = aggregateKeywords(result.currentRows);
    const previousByKeyword = aggregateKeywords(result.previousRows);

    const topCurrentKeywords = [...currentByKeyword.values()]
      .sort((left, right) => right.impressions - left.impressions)
      .slice(0, 20);

    const rows: KeywordHealthRow[] = topCurrentKeywords.map((current) => {
      const previous = previousByKeyword.get(current.keyword);
      const currentPosition = current.position;
      const previousPosition = previous?.position ?? null;
      const delta =
        currentPosition == null || previousPosition == null
          ? 0
          : currentPosition - previousPosition;
      return {
        keyword: current.keyword,
        page_url: current.page_url,
        current_position: currentPosition,
        previous_position: previousPosition,
        position_delta: delta,
        current_clicks: current.clicks,
        previous_clicks: previous?.clicks ?? 0,
        current_impressions: current.impressions,
        previous_impressions: previous?.impressions ?? 0,
        dropped_by_3_plus: delta >= 3,
      };
    });
    return NextResponse.json({
      ok: true,
      propertyUrl: result.propertyUrl,
      currentWindow: {
        startDate: result.currentStartDate,
        endDate: result.currentEndDate,
      },
      previousWindow: {
        startDate: result.previousStartDate,
        endDate: result.previousEndDate,
      },
      rows,
      attentionNeeded: rows.filter((row) => row.dropped_by_3_plus),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to compute keyword health.",
      },
      { status: 500 },
    );
  }
}
