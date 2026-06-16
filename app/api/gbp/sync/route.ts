import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runGbpSync } from "@/lib/gbp/google-business-profile";
import type { GbpReviewRow, GbpSnapshot } from "@/lib/types/client";

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

  const now = new Date().toISOString();
  const { data: createdSnapshot, error: createSnapshotError } = await admin
    .from("client_gbp_snapshots")
    .insert({
      client_id: clientId,
      place_id: clientRow.google_place_id,
      run_status: "running",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single<GbpSnapshot>();
  if (createSnapshotError || !createdSnapshot) {
    return NextResponse.json(
      { error: createSnapshotError?.message ?? "Failed to create GBP snapshot." },
      { status: 500 },
    );
  }

  try {
    const result = await runGbpSync(clientRow.google_place_id);
    const updatedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("client_gbp_snapshots")
      .update({
        place_id: result.placeId,
        place_name: result.placeName,
        profile_url: result.profileUrl,
        website_url: result.websiteUrl,
        address: result.address,
        rating: result.rating,
        user_ratings_total: result.userRatingsTotal,
        run_status: "completed",
        error_message: null,
        updated_at: updatedAt,
      })
      .eq("id", createdSnapshot.id);
    if (updateError) throw new Error(updateError.message);

    const { error: clearReviewsError } = await admin
      .from("client_gbp_reviews")
      .delete()
      .eq("client_id", clientId);
    if (clearReviewsError) throw new Error(clearReviewsError.message);

    if (result.reviews.length > 0) {
      const reviewRows: Omit<GbpReviewRow, "id">[] = result.reviews.map((row) => ({
        client_id: clientId,
        snapshot_id: createdSnapshot.id,
        author_name: row.authorName,
        rating: row.rating,
        text: row.text,
        relative_time_description: row.relativeTimeDescription,
        review_time_unix: row.reviewTimeUnix,
        created_at: updatedAt,
      }));
      const { error: insertReviewsError } = await admin
        .from("client_gbp_reviews")
        .insert(reviewRows);
      if (insertReviewsError) throw new Error(insertReviewsError.message);
    }

    const [snapshotResult, reviewsResult] = await Promise.all([
      admin
        .from("client_gbp_snapshots")
        .select("*")
        .eq("id", createdSnapshot.id)
        .single<GbpSnapshot>(),
      admin
        .from("client_gbp_reviews")
        .select("*")
        .eq("client_id", clientId)
        .order("review_time_unix", { ascending: false, nullsFirst: false })
        .returns<GbpReviewRow[]>(),
    ]);
    if (snapshotResult.error || !snapshotResult.data) {
      throw new Error(snapshotResult.error?.message ?? "Failed to load GBP snapshot.");
    }
    if (reviewsResult.error) {
      throw new Error(reviewsResult.error.message);
    }
    const reviews = reviewsResult.data ?? [];
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
      snapshot: snapshotResult.data,
      reviews,
      diagnostics: {
        fetchedReviewCount: result.reviews.length,
        storedReviewCount: reviews.length,
        latestReviewTimeUnix,
        topReviews,
        sourceBreakdown: result.diagnostics ?? {
          placesReviewCount: 0,
          legacyReviewCount: 0,
          gbpApiReviewCount: 0,
          matchedGbpLocationCount: 0,
          gbpApiError: null,
        },
      },
    });
  } catch (error) {
    await admin
      .from("client_gbp_snapshots")
      .update({
        run_status: "failed",
        error_message: error instanceof Error ? error.message : "GBP sync failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GBP sync failed" },
      { status: 500 },
    );
  }
}
