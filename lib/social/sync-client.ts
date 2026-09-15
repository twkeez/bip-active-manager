import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchFacebookDaily,
  fetchFacebookPosts,
  fetchInstagramDaily,
  fetchInstagramMedia,
  fetchInstagramPeriodReach,
  fetchMetaPageForClient,
  listMetaPages,
} from "@/lib/social/meta";
import { buildSocialSignals, type SocialSignalDraft } from "@/lib/social/signals";
import { getMetaAccessTokenForSync } from "@/lib/social/token-manager";
import type {
  SocialConnection,
  SocialDailySnapshot,
  SocialPostSnapshot,
  SocialSignal,
} from "@/lib/types/client";

/**
 * Syncing one client's social data.
 *
 * Lifted out of the button's route so the nightly job runs exactly the same
 * work — the reason Facebook metrics were missing for 3,147 posts is that
 * nobody was watching this path, and two code paths would be two chances to
 * miss it again.
 */

export class SocialSyncError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type SocialSyncResult = {
  connection: SocialConnection;
  dailySnapshots: SocialDailySnapshot[];
  postSnapshots: SocialPostSnapshot[];
  signals: SocialSignal[];
  /** What Meta would not give us this run. Empty on a clean sync. */
  warnings: string[];
};

export async function syncClientSocial(
  admin: SupabaseClient,
  clientId: number,
): Promise<SocialSyncResult> {
  const tokenState = await getMetaAccessTokenForSync(admin);
  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("id,account_name,website")
    .eq("id", clientId)
    .single<{ id: number; account_name: string; website: string | null }>();
  if (clientError || !clientRow) {
    throw new SocialSyncError(clientError?.message ?? "Client not found", 404);
  }

  const { data: existingConnection } = await admin
    .from("client_social_connections")
    .select("page_id")
    .eq("client_id", clientId)
    .eq("platform", "facebook")
    .maybeSingle<{ page_id: string | null }>();

  const page = await fetchMetaPageForClient(
    clientRow.account_name,
    clientRow.website ?? "",
    existingConnection?.page_id ?? null,
    tokenState.accessToken,
  );
  if (!page) {
    const candidates = await listMetaPages(tokenState.accessToken);
    throw new SocialSyncError(
      candidates.length === 0
        ? "No Facebook pages are accessible with the current Meta token. Confirm it is a long-lived user token with page permissions (pages_show_list, pages_read_engagement, instagram_basic, instagram_manage_insights) and that the user is connected to the Page assets."
        : "No matching Facebook page found for this client. A token is working, but page-name/domain matching did not find a confident result. Use one of the returned candidate pages to map this client manually.",
      404,
      { candidatePages: candidates.slice(0, 10) },
    );
  }
  if (!page.access_token) {
    throw new SocialSyncError("Matched page does not include a page access token.", 400);
  }

  const { data: fbConnection, error: fbConnectionError } = await admin
    .from("client_social_connections")
    .upsert(
      {
        client_id: clientId,
        platform: "facebook",
        page_id: page.id,
        ig_user_id: page.instagram_business_account?.id ?? null,
        account_username: page.instagram_business_account?.username ?? null,
        account_name: page.name ?? null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,platform" },
    )
    .select("*")
    .single<SocialConnection>();
  if (fbConnectionError || !fbConnection) {
    throw new SocialSyncError(
      fbConnectionError?.message ?? "Failed to upsert Facebook connection.",
      500,
    );
  }

  const igUserId = page.instagram_business_account?.id;
  const [facebookDaily, facebook, instagramDaily, instagramMedia, instagramPeriodReach] =
    await Promise.all([
      fetchFacebookDaily(page.id, page.access_token),
      fetchFacebookPosts(page.id, page.access_token),
      igUserId ? fetchInstagramDaily(igUserId, page.access_token) : Promise.resolve([]),
      igUserId ? fetchInstagramMedia(igUserId, page.access_token) : Promise.resolve([]),
      igUserId ? fetchInstagramPeriodReach(igUserId, page.access_token) : Promise.resolve(null),
    ]);

  const warnings: string[] = [];
  if (!facebook.linkClicksAvailable) {
    warnings.push(
      "Meta refused the post_clicks metric, so Facebook link clicks were not collected this run.",
    );
  }

  const dailyRow = (platform: "facebook" | "instagram") => (row: {
    snapshot_date: string;
    values: Record<string, number | null | undefined>;
  }) => ({
    client_id: clientId,
    connection_id: fbConnection.id,
    platform,
    snapshot_date: row.snapshot_date,
    reach: row.values.reach ?? null,
    impressions: row.values.impressions ?? null,
    engagement: row.values.engagement ?? null,
    profile_visits: row.values.profile_visits ?? null,
    follows: row.values.follows ?? null,
    link_clicks: row.values.link_clicks ?? null,
  });

  const dailyPayload = [
    ...facebookDaily.map(dailyRow("facebook")),
    ...instagramDaily.map(dailyRow("instagram")),
  ];
  if (dailyPayload.length > 0) {
    const { error } = await admin
      .from("client_social_daily_snapshots")
      .upsert(dailyPayload, { onConflict: "client_id,platform,snapshot_date" });
    if (error) {
      throw new SocialSyncError(`Failed to store social daily snapshots: ${error.message}`, 500);
    }
  }

  if (typeof instagramPeriodReach === "number") {
    await admin.from("client_social_period_metrics").upsert(
      {
        client_id: clientId,
        platform: "instagram",
        reach: instagramPeriodReach,
        window_days: 30,
        captured_at: new Date().toISOString(),
      },
      { onConflict: "client_id,platform" },
    );
  }

  // Facebook and Instagram return slightly different shapes — shares exist on
  // one, saves on neither — so the row the table wants is stated once here.
  type FetchedPost = {
    post_id: string;
    media_type: string | null;
    permalink: string | null;
    caption: string | null;
    published_at: string | null;
    impressions: number | null;
    reach: number | null;
    engagement: number | null;
    comments: number | null;
    saves: number | null;
    shares: number | null;
    link_clicks: number | null;
  };
  const postRow = (platform: "facebook" | "instagram") => (row: FetchedPost) => ({
    client_id: clientId,
    connection_id: fbConnection.id,
    platform,
    post_id: row.post_id,
    media_type: row.media_type,
    permalink: row.permalink,
    caption: row.caption,
    published_at: row.published_at,
    reach: row.reach,
    impressions: row.impressions,
    engagement: row.engagement,
    comments: row.comments,
    saves: row.saves,
    shares: row.shares,
    link_clicks: row.link_clicks,
    updated_at: new Date().toISOString(),
  });

  const postPayload = [
    ...facebook.posts.map(postRow("facebook")),
    ...instagramMedia.map(postRow("instagram")),
  ];
  if (postPayload.length > 0) {
    const { error } = await admin
      .from("client_social_post_snapshots")
      .upsert(postPayload, { onConflict: "client_id,platform,post_id" });
    if (error) {
      throw new SocialSyncError(`Failed to store social post snapshots: ${error.message}`, 500);
    }
  }

  const [dailyRowsResult, postRowsResult] = await Promise.all([
    admin
      .from("client_social_daily_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("snapshot_date", { ascending: false })
      .limit(30)
      .returns<SocialDailySnapshot[]>(),
    admin
      .from("client_social_post_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("published_at", { ascending: false })
      .limit(50)
      .returns<SocialPostSnapshot[]>(),
  ]);
  if (dailyRowsResult.error || postRowsResult.error) {
    throw new SocialSyncError(
      dailyRowsResult.error?.message ?? postRowsResult.error?.message ?? "Social data load failed",
      500,
    );
  }

  const drafts: SocialSignalDraft[] = buildSocialSignals(
    dailyRowsResult.data ?? [],
    postRowsResult.data ?? [],
  );
  // A metric Meta refused is recorded as a signal rather than written away as
  // a null. Silent nulls are what hid this for two months: "nobody engaged"
  // and "we did not ask properly" looked identical on every screen.
  if (!facebook.linkClicksAvailable) {
    drafts.push({
      signal_id: "social_fb_link_clicks_unavailable",
      severity: "watch",
      title: "Facebook link clicks are not being collected",
      description:
        "Meta rejected the post_clicks metric for this page, so link clicks on Facebook posts are blank rather than zero.",
      suggestion:
        "Check the page's permissions. Until this clears, do not read a blank as 'nobody clicked'.",
      metric_value: null,
      platform: "facebook",
    });
  }

  const { error: clearSignalsError } = await admin
    .from("client_social_signals")
    .delete()
    .eq("client_id", clientId);
  if (clearSignalsError) {
    throw new SocialSyncError(
      `Failed to clear previous social signals: ${clearSignalsError.message}`,
      500,
    );
  }
  if (drafts.length > 0) {
    const { error } = await admin
      .from("client_social_signals")
      .insert(drafts.map((signal) => ({ client_id: clientId, ...signal })));
    if (error) {
      throw new SocialSyncError(`Failed to store social signals: ${error.message}`, 500);
    }
  }

  const signalsResult = await admin
    .from("client_social_signals")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .returns<SocialSignal[]>();
  if (signalsResult.error) {
    throw new SocialSyncError(`Failed to load social signals: ${signalsResult.error.message}`, 500);
  }

  return {
    connection: fbConnection,
    dailySnapshots: dailyRowsResult.data ?? [],
    postSnapshots: postRowsResult.data ?? [],
    signals: signalsResult.data ?? [],
    warnings,
  };
}
