import type { SupabaseClient } from "@supabase/supabase-js";
import { runGbpSync, type GbpSyncResult } from "@/lib/gbp/google-business-profile";
import { NotReputationClientError, isReputationClient } from "@/lib/gbp/reputation-only";
import type { GbpReviewRow, GbpSnapshot } from "@/lib/types/client";

/**
 * One client's Google Business Profile refresh: the listing and its reviews.
 *
 * Extracted from the sync route so the nightly job runs exactly what the
 * button runs.
 *
 * Reviews are replaced only when the Business Profile API itself answered for
 * this location, because only then is the fetched set the full list. When it
 * failed (refused, no quota, location not in our accounts), what is left is
 * the ~5 reviews the public Places API returns, and replacing with those used
 * to wipe the stored set down to 5 every night (found 2026-09-28). Now the
 * stored reviews are kept, the result says reviews were not refreshed, and the
 * nightly job reports it.
 */

export type GbpSyncResultSummary = {
  snapshot: GbpSnapshot;
  fetchedReviewCount: number;
  storedReviewCount: number;
  /** Which source the reviews came from — the reporting tab shows this. */
  sourceBreakdown: NonNullable<GbpSyncResult["diagnostics"]>;
  /** False when the Business Profile API did not answer: stored reviews were kept, not replaced. */
  reviewsRefreshed: boolean;
  /** Why reviews were not refreshed, when they were not. */
  reviewsError: string | null;
};

export async function syncClientGbp(
  admin: SupabaseClient,
  clientId: number,
  placeId: string,
): Promise<GbpSyncResultSummary> {
  // Every refresh path (nightly and the manual button) comes through here, so
  // this is where the reputation-only rule holds. Checked before anything is
  // written or any Google call is made.
  const { data: clientRow, error: clientError } = await admin.from("clients").select("orm").eq("id", clientId).maybeSingle();
  if (clientError) throw new Error(`Could not read the client: ${clientError.message}`);
  if (!isReputationClient((clientRow as { orm?: string | null } | null)?.orm)) throw new NotReputationClientError();

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

    const diagnostics = result.diagnostics;
    const apiAnswered = Boolean(diagnostics && !diagnostics.gbpApiError && diagnostics.matchedGbpLocationCount > 0);
    const reviewsError = apiAnswered
      ? null
      : diagnostics?.gbpApiError
        ? `Business Profile API: ${diagnostics.gbpApiError}`
        : "This location was not found in our Business Profile accounts.";

    const { count: storedBefore } = await admin
      .from("client_gbp_reviews")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);
    // Replace only with a complete set. With nothing stored yet, the partial
    // set is still better than none.
    const replace = apiAnswered || !storedBefore;

    if (replace) {
      const { error: clearReviewsError } = await admin
        .from("client_gbp_reviews")
        .delete()
        .eq("client_id", clientId);
      if (clearReviewsError) throw new Error(clearReviewsError.message);
    }

    if (replace && result.reviews.length > 0) {
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
      reviewsRefreshed: apiAnswered,
      reviewsError,
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
