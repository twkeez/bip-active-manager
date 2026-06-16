import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchFacebookDaily,
  fetchFacebookPosts,
  fetchInstagramDaily,
  fetchInstagramMedia,
  fetchMetaPageForClient,
  listMetaPages,
} from "@/lib/social/meta";
import { getMetaAccessTokenForSync } from "@/lib/social/token-manager";
import { buildSocialSignals } from "@/lib/social/signals";
import type {
  SocialConnection,
  SocialDailySnapshot,
  SocialPostSnapshot,
  SocialSignal,
} from "@/lib/types/client";

type SyncRequestBody = {
  clientId?: number;
};

export async function POST(request: Request) {
  try {
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
    const tokenState = await getMetaAccessTokenForSync(admin);
    const { data: clientRow, error: clientError } = await admin
      .from("clients")
      .select("id,account_name,website")
      .eq("id", clientId)
      .single<{ id: number; account_name: string; website: string | null }>();
    if (clientError || !clientRow) {
      return NextResponse.json(
        { error: clientError?.message ?? "Client not found" },
        { status: 404 },
      );
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
      const noAccessiblePages = candidates.length === 0;
      return NextResponse.json(
        {
          error: noAccessiblePages
            ? "No Facebook pages are accessible with the current Meta token. Confirm it is a long-lived user token with page permissions (pages_show_list, pages_read_engagement, instagram_basic, instagram_manage_insights) and that the user is connected to the Page assets."
            : "No matching Facebook page found for this client. A token is working, but page-name/domain matching did not find a confident result. Use one of the returned candidate pages to map this client manually.",
          candidatePages: candidates.slice(0, 10),
        },
        { status: 404 },
      );
    }
    if (!page.access_token) {
      return NextResponse.json(
        { error: "Matched page does not include a page access token." },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: fbConnectionError?.message ?? "Failed to upsert Facebook connection." },
        { status: 500 },
      );
    }

    const [facebookDaily, facebookPosts, instagramDaily, instagramMedia] = await Promise.all([
      fetchFacebookDaily(page.id, page.access_token),
      fetchFacebookPosts(page.id, page.access_token),
      page.instagram_business_account?.id
        ? fetchInstagramDaily(page.instagram_business_account.id, page.access_token)
        : Promise.resolve([]),
      page.instagram_business_account?.id
        ? fetchInstagramMedia(page.instagram_business_account.id, page.access_token)
        : Promise.resolve([]),
    ]);

    const dailyPayload = [
    ...facebookDaily.map((row) => ({
      client_id: clientId,
      connection_id: fbConnection.id,
      platform: "facebook" as const,
      snapshot_date: row.snapshot_date,
      reach: row.values.reach ?? null,
      impressions: row.values.impressions ?? null,
      engagement: row.values.engagement ?? null,
      profile_visits: row.values.profile_visits ?? null,
      follows: row.values.follows ?? null,
      link_clicks: row.values.link_clicks ?? null,
    })),
    ...instagramDaily.map((row) => ({
      client_id: clientId,
      connection_id: fbConnection.id,
      platform: "instagram" as const,
      snapshot_date: row.snapshot_date,
      reach: row.values.reach ?? null,
      impressions: row.values.impressions ?? null,
      engagement: row.values.engagement ?? null,
      profile_visits: row.values.profile_visits ?? null,
      follows: row.values.follows ?? null,
      link_clicks: row.values.link_clicks ?? null,
    })),
  ];
    if (dailyPayload.length > 0) {
      const { error: dailyError } = await admin
        .from("client_social_daily_snapshots")
        .upsert(dailyPayload, { onConflict: "client_id,platform,snapshot_date" });
      if (dailyError) {
        return NextResponse.json(
          { error: `Failed to store social daily snapshots: ${dailyError.message}` },
          { status: 500 },
        );
      }
    }

    const postPayload = [
    ...facebookPosts.map((row) => ({
      client_id: clientId,
      connection_id: fbConnection.id,
      platform: "facebook" as const,
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
    })),
    ...instagramMedia.map((row) => ({
      client_id: clientId,
      connection_id: fbConnection.id,
      platform: "instagram" as const,
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
    })),
  ];
    if (postPayload.length > 0) {
      const { error: postsError } = await admin
        .from("client_social_post_snapshots")
        .upsert(postPayload, { onConflict: "client_id,platform,post_id" });
      if (postsError) {
        return NextResponse.json(
          { error: `Failed to store social post snapshots: ${postsError.message}` },
          { status: 500 },
        );
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
      return NextResponse.json(
        {
          error:
            dailyRowsResult.error?.message ??
            postRowsResult.error?.message ??
            "Social data load failed",
        },
        { status: 500 },
      );
    }

    const socialSignals = buildSocialSignals(
      (dailyRowsResult.data ?? []) as SocialDailySnapshot[],
      (postRowsResult.data ?? []) as SocialPostSnapshot[],
    );
    const { error: clearSignalsError } = await admin
      .from("client_social_signals")
      .delete()
      .eq("client_id", clientId);
    if (clearSignalsError) {
      return NextResponse.json(
        { error: `Failed to clear previous social signals: ${clearSignalsError.message}` },
        { status: 500 },
      );
    }
    if (socialSignals.length > 0) {
      const { error: insertSignalsError } = await admin.from("client_social_signals").insert(
        socialSignals.map((signal) => ({
          client_id: clientId,
          ...signal,
        })),
      );
      if (insertSignalsError) {
        return NextResponse.json(
          { error: `Failed to store social signals: ${insertSignalsError.message}` },
          { status: 500 },
        );
      }
    }
    const signalsResult = await admin
      .from("client_social_signals")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .returns<SocialSignal[]>();
    if (signalsResult.error) {
      return NextResponse.json(
        { error: `Failed to load social signals: ${signalsResult.error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      connection: fbConnection,
      dailySnapshots: dailyRowsResult.data ?? [],
      postSnapshots: postRowsResult.data ?? [],
      signals: signalsResult.data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Social sync crashed: ${error.message}`
            : "Social sync crashed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
