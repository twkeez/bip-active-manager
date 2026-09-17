import type { SupabaseClient } from "@supabase/supabase-js";
import { runGbpSync, type GbpSyncResult } from "@/lib/gbp/google-business-profile";
import type { GbpReviewRow, GbpSnapshot } from "@/lib/types/client";

/**
 * One client's Google Business Profile refresh: the listing and its reviews.
 *
 * Extracted from the sync route so the nightly job runs exactly what the
 * button runs. Reviews are replaced rather than merged, because the Places API
 * returns a rolling window rather than a full history — merging would leave
 * deleted reviews on file forever, and the rating is taken from the listing
 * itself, not from the rows.
 */

export type GbpSyncResultSummary = {
  snapshot: GbpSnapshot;
  fetchedReviewCount: number;
  storedReviewCount: number;
  /** Which source the reviews came from — the reporting tab shows this. */
  sourceBreakdown: NonNullable<GbpSyncResult["diagnostics"]>;
};

export async function syncClientGbp(
  admin: SupabaseClient,
  clientId: number,
  placeId: string,
): Promise<GbpSyncResultSummary> {
  const now = new Date().toISOString();
  const { data: createdSnapshot, error: createSnapshotError } = await admin
    .from("client_gbp_snapshots")
    .insert({
      client_id: clientId,
      place_id: placeId,
      run_status: "running",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single<GbpSnapshot>();
  if (createSnapshotError || !createdSnapshot) {
    throw new Error(createSnapshotError?.message ?? "Failed to create GBP snapshot.");
  }

  try {
    const result = await runGbpSync(placeId);
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
        last_post_at: result.lastPostAt ?? null,
        profile_fields: result.profileFields ?? null,
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

    const { data: snapshot, error: reloadError } = await admin
      .from("client_gbp_snapshots")
      .select("*")
      .eq("id", createdSnapshot.id)
      .single<GbpSnapshot>();
    if (reloadError || !snapshot) {
      throw new Error(reloadError?.message ?? "Failed to load GBP snapshot.");
    }

    const { count } = await admin
      .from("client_gbp_reviews")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);

    return {
      snapshot,
      fetchedReviewCount: result.reviews.length,
      storedReviewCount: count ?? result.reviews.length,
      sourceBreakdown: result.diagnostics ?? {
        placesReviewCount: 0,
        legacyReviewCount: 0,
        gbpApiReviewCount: 0,
        matchedGbpLocationCount: 0,
        gbpApiError: null,
      },
    };
  } catch (error) {
    await admin
      .from("client_gbp_snapshots")
      .update({
        run_status: "failed",
        error_message: error instanceof Error ? error.message : "GBP sync failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id);
    throw error;
  }
}
