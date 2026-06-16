import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isoDaysAgo } from "@/lib/time";
import { buildAdsAuditReport } from "@/lib/ads/audit";
import { fetchAdsAuditSupplement } from "@/lib/ads/audit-fetch";
import { generateAdsAuditNarrative } from "@/lib/ads/audit-narrative";
import { createSearchStreamContext, runGoogleAdsSync, type AdsSyncResult } from "@/lib/ads/google-ads";
import { buildAdsSignals } from "@/lib/ads/signals";
import type { AdsAuditSnapshot, AdsCampaignMetric, AdsSnapshot } from "@/lib/types/client";

type RunBody = {
  clientId?: number;
  includeNarrative?: boolean;
  skipSync?: boolean;
};

function isoDate(value: string) {
  return value.slice(0, 10);
}

function snapshotToSyncResult(snapshot: AdsSnapshot): AdsSyncResult {
  return {
    customerId: snapshot.customer_id,
    startDate: snapshot.start_date,
    endDate: snapshot.end_date,
    totals: {
      impressions: snapshot.totals.impressions,
      clicks: snapshot.totals.clicks,
      cost_micros: snapshot.totals.cost_micros,
      conversions: snapshot.totals.conversions,
      ctr: snapshot.totals.ctr,
      average_cpc: snapshot.totals.average_cpc,
      search_impression_share: snapshot.totals.search_impression_share ?? null,
      search_rank_lost_impression_share:
        snapshot.totals.search_rank_lost_impression_share ?? null,
      search_budget_lost_impression_share:
        snapshot.totals.search_budget_lost_impression_share ?? null,
    },
    campaigns: snapshot.campaigns.map((campaign) => ({
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      cost_micros: campaign.cost_micros,
      conversions: campaign.conversions,
      ctr: campaign.ctr,
      search_impression_share: campaign.search_impression_share ?? null,
      search_rank_lost_impression_share: campaign.search_rank_lost_impression_share ?? null,
      search_budget_lost_impression_share: campaign.search_budget_lost_impression_share ?? null,
    })),
    auctionInsights: snapshot.auction_insights ?? [],
    keywordQuality: snapshot.keyword_quality ?? [],
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RunBody;
  try {
    body = (await request.json()) as RunBody;
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
    .select("id,account_name,ads_customer_id")
    .eq("id", clientId)
    .single<{ id: number; account_name: string; ads_customer_id: string | null }>();
  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }
  if (!clientRow.ads_customer_id?.trim()) {
    return NextResponse.json(
      { error: "Client is missing ads_customer_id." },
      { status: 400 },
    );
  }

  const startDate = isoDate(isoDaysAgo(30));
  const endDate = isoDate(new Date().toISOString());

  const { data: createdAudit, error: createAuditError } = await admin
    .from("client_ads_audit_snapshots")
    .insert({
      client_id: clientId,
      start_date: startDate,
      end_date: endDate,
      run_status: "running",
      report: {},
    })
    .select("*")
    .single<AdsAuditSnapshot>();
  if (createAuditError || !createdAudit) {
    return NextResponse.json(
      { error: createAuditError?.message ?? "Failed to create audit run." },
      { status: 500 },
    );
  }

  try {
    let adsSnapshotId: number | null = null;
    let sync: AdsSyncResult;

    if (body.skipSync) {
      const { data: latestSnapshot } = await admin
        .from("client_ads_snapshots")
        .select("*")
        .eq("client_id", clientId)
        .eq("run_status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<AdsSnapshot>();
      if (!latestSnapshot) {
        throw new Error("No completed ads snapshot found. Run ads sync first.");
      }
      adsSnapshotId = latestSnapshot.id;
      sync = snapshotToSyncResult(latestSnapshot);
    } else {
      sync = await runGoogleAdsSync(clientRow.ads_customer_id, startDate, endDate);
      const campaigns = sync.campaigns.slice(0, 20);
      const { data: createdSnapshot, error: snapshotError } = await admin
        .from("client_ads_snapshots")
        .insert({
          client_id: clientId,
          customer_id: clientRow.ads_customer_id,
          start_date: startDate,
          end_date: endDate,
          run_status: "completed",
          totals: sync.totals,
          campaigns,
          auction_insights: sync.auctionInsights,
          keyword_quality: sync.keywordQuality,
        })
        .select("*")
        .single<AdsSnapshot>();
      if (snapshotError || !createdSnapshot) {
        throw new Error(snapshotError?.message ?? "Failed to store ads snapshot.");
      }
      adsSnapshotId = createdSnapshot.id;

      await admin.from("client_ads_signals").delete().eq("client_id", clientId);
      const signalDrafts = buildAdsSignals(
        sync.totals,
        campaigns as AdsCampaignMetric[],
        sync.keywordQuality,
      );
      if (signalDrafts.length) {
        await admin.from("client_ads_signals").insert(
          signalDrafts.map((signal) => ({
            client_id: clientId,
            snapshot_id: createdSnapshot.id,
            ...signal,
          })),
        );
      }
    }

    const { ctx } = await createSearchStreamContext(clientRow.ads_customer_id);
    const supplement = await fetchAdsAuditSupplement(ctx, sync.startDate, sync.endDate);
    const report = buildAdsAuditReport({
      accountName: clientRow.account_name,
      sync,
      supplement,
    });

    let narrativeMarkdown: string | null = null;
    if (body.includeNarrative !== false) {
      try {
        narrativeMarkdown = await generateAdsAuditNarrative(report);
      } catch {
        narrativeMarkdown = null;
      }
    }

    const { data: updatedAudit, error: updateError } = await admin
      .from("client_ads_audit_snapshots")
      .update({
        ads_snapshot_id: adsSnapshotId,
        start_date: sync.startDate,
        end_date: sync.endDate,
        report,
        narrative_markdown: narrativeMarkdown,
        run_status: "completed",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdAudit.id)
      .select("*")
      .single<AdsAuditSnapshot>();
    if (updateError || !updatedAudit) {
      throw new Error(updateError?.message ?? "Failed to save audit.");
    }

    return NextResponse.json({ ok: true, audit: updatedAudit });
  } catch (error) {
    await admin
      .from("client_ads_audit_snapshots")
      .update({
        run_status: "failed",
        error_message: error instanceof Error ? error.message : "Audit failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdAudit.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Audit failed" },
      { status: 500 },
    );
  }
}
