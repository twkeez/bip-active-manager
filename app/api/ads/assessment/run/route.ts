import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAdsAuditReport } from "@/lib/ads/audit";
import { fetchAdsAuditSupplement } from "@/lib/ads/audit-fetch";
import { generateAdsAssessment } from "@/lib/ads/assessment";
import { createSearchStreamContext, type AdsSyncResult } from "@/lib/ads/google-ads";
import type {
  AdsAuctionInsightRow,
  AdsAuditReport,
  AdsAuditSnapshot,
  AdsAssessmentSnapshot,
  AdsSnapshot,
} from "@/lib/types/client";

export const maxDuration = 120;

type RunBody = { clientId?: number };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: clientError?.message ?? "Client not found" }, { status: 404 });
  }
  if (!clientRow.ads_customer_id?.trim()) {
    return NextResponse.json({ error: "Client is missing ads_customer_id." }, { status: 400 });
  }

  // Latest completed ads snapshot (needed for auction insights and as audit fallback).
  const { data: adsSnapshot } = await admin
    .from("client_ads_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AdsSnapshot>();

  if (!adsSnapshot) {
    return NextResponse.json(
      { error: "No Google Ads data yet — run a Google Ads sync for this client first." },
      { status: 400 },
    );
  }

  // Prefer the most recent audit report; otherwise build one from the snapshot.
  const { data: auditSnapshot } = await admin
    .from("client_ads_audit_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .eq("run_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AdsAuditSnapshot>();

  // Create the assessment row up front so failures are recorded.
  const startDate = auditSnapshot?.start_date ?? adsSnapshot.start_date;
  const endDate = auditSnapshot?.end_date ?? adsSnapshot.end_date;
  const { data: created, error: createError } = await admin
    .from("client_ads_assessments")
    .insert({
      client_id: clientId,
      ads_snapshot_id: adsSnapshot.id,
      audit_snapshot_id: auditSnapshot?.id ?? null,
      start_date: startDate,
      end_date: endDate,
      run_status: "running",
      assessment: {},
    })
    .select("*")
    .single<AdsAssessmentSnapshot>();
  if (createError || !created) {
    return NextResponse.json(
      { error: createError?.message ?? "Failed to create assessment run." },
      { status: 500 },
    );
  }

  try {
    let report: AdsAuditReport;
    if (auditSnapshot?.report && Object.keys(auditSnapshot.report).length > 0) {
      report = auditSnapshot.report;
    } else {
      // Build the audit report on the fly from the cached snapshot + a fresh supplement.
      const sync = {
        customerId: adsSnapshot.customer_id,
        startDate: adsSnapshot.start_date,
        endDate: adsSnapshot.end_date,
        totals: adsSnapshot.totals,
        campaigns: [],
        auctionInsights: adsSnapshot.auction_insights ?? [],
        keywordQuality: adsSnapshot.keyword_quality ?? [],
      } as unknown as AdsSyncResult;
      const { ctx } = await createSearchStreamContext(clientRow.ads_customer_id);
      const supplement = await fetchAdsAuditSupplement(ctx, sync.startDate, sync.endDate);
      report = buildAdsAuditReport({
        accountName: clientRow.account_name,
        sync,
        supplement,
      });
    }

    const auctionInsights: AdsAuctionInsightRow[] = adsSnapshot.auction_insights ?? [];
    const assessment = await generateAdsAssessment({
      accountName: clientRow.account_name,
      report,
      auctionInsights,
    });

    const { data: updated, error: updateError } = await admin
      .from("client_ads_assessments")
      .update({
        assessment,
        run_status: "completed",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id)
      .select("*")
      .single<AdsAssessmentSnapshot>();
    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Failed to save assessment.");
    }

    return NextResponse.json({ ok: true, assessment: updated });
  } catch (error) {
    await admin
      .from("client_ads_assessments")
      .update({
        run_status: "failed",
        error_message: error instanceof Error ? error.message : "Assessment failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Assessment failed" },
      { status: 500 },
    );
  }
}
