import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncClientGbp } from "@/lib/gbp/sync-client";
import type { GbpReviewRow } from "@/lib/types/client";

/**
 * The "sync" button for one client's Google Business Profile.
 *
 * The work itself lives in lib/gbp/sync-client so the nightly job runs exactly
 * this; what stays here is the session check and the richer response the screen
 * reads back.
 */

type SyncRequestBody = {
  clientId?: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SyncRequestBody;
  try {
    body = (await request.json()) as SyncRequestBody;
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
    .select("id,google_place_id")
    .eq("id", clientId)
    .single<{ id: number; google_place_id: string | null }>();
  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }
  if (!clientRow.google_place_id?.trim()) {
    return NextResponse.json(
      { error: "Client is missing google_place_id." },
      { status: 400 },
    );
  }

  try {
    const result = await syncClientGbp(admin, clientId, clientRow.google_place_id);

    const { data: reviewRows, error: reviewsError } = await admin
      .from("client_gbp_reviews")
      .select("*")
      .eq("client_id", clientId)
      .order("review_time_unix", { ascending: false, nullsFirst: false })
      .returns<GbpReviewRow[]>();
    if (reviewsError) throw new Error(reviewsError.message);
    const reviews = reviewRows ?? [];

    const latestReviewTimeUnix = reviews.reduce<number | null>((latest, row) => {
      if (typeof row.review_time_unix !== "number") return latest;
      return latest == null ? row.review_time_unix : Math.max(latest, row.review_time_unix);
    }, null);
    const topReviews = reviews.slice(0, 3).map((row) => ({
      authorName: row.author_name ?? null,
      reviewTimeUnix: typeof row.review_time_unix === "number" ? row.review_time_unix : null,
      relativeTimeDescription: row.relative_time_description ?? null,
      rating: typeof row.rating === "number" ? row.rating : null,
    }));

    return NextResponse.json({
      ok: true,
      snapshot: result.snapshot,
      reviews,
      diagnostics: {
        fetchedReviewCount: result.fetchedReviewCount,
        storedReviewCount: reviews.length,
        latestReviewTimeUnix,
        topReviews,
        sourceBreakdown: result.sourceBreakdown,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GBP sync failed" },
      { status: 500 },
    );
  }
}
