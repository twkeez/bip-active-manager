import { NextResponse } from "next/server";
import {
  fetchPlaceSnapshot,
  getReviewTask,
  postReviewTask,
} from "@/lib/dataforseo/reputation";
import { generateReputationReport } from "@/lib/reputation/analyze";
import { getDataForSeoConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Action = "refresh" | "collect" | "report";

function parseClientId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Latest stored state — cheap, hits no third-party API.
export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const clientId = parseClientId((await context.params).clientId);
  if (!clientId) return NextResponse.json({ error: "Invalid client id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [snapshot, report, reviews] = await Promise.all([
    supabase
      .from("client_reputation_snapshots")
      .select("*")
      .eq("client_id", clientId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("client_reputation_reports")
      .select("*")
      .eq("client_id", clientId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("client_reviews")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
  ]);

  return NextResponse.json({
    snapshot: snapshot.data ?? null,
    report: report.data ?? null,
    reviewCount: reviews.count ?? 0,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  const clientId = parseClientId((await context.params).clientId);
  if (!clientId) return NextResponse.json({ error: "Invalid client id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: Action; taskId?: string };
  try {
    body = (await request.json()) as { action?: Action; taskId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("account_name, google_place_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const admin = createAdminClient();

  try {
    // ── refresh: profile stats now, review pull queued for later collection ──
    if (body.action === "refresh") {
      const config = getDataForSeoConfig();
      if (!config) {
        return NextResponse.json(
          { error: "DataForSEO credentials are not configured on the server." },
          { status: 503 },
        );
      }
      const placeId = (client.google_place_id ?? "").trim();
      if (!placeId) {
        return NextResponse.json(
          { error: `${client.account_name} has no Google Place ID on file.` },
          { status: 422 },
        );
      }

      const snapshot = await fetchPlaceSnapshot(config, placeId);
      if (!snapshot.ok) return NextResponse.json({ error: snapshot.error }, { status: 502 });

      await admin.from("client_reputation_snapshots").insert({
        client_id: clientId,
        place_id: snapshot.snapshot.placeId,
        title: snapshot.snapshot.title,
        rating: snapshot.snapshot.rating,
        votes_count: snapshot.snapshot.votesCount,
        rating_distribution: snapshot.snapshot.ratingDistribution,
        place_topics: snapshot.snapshot.placeTopics,
        address: snapshot.snapshot.address,
        city: snapshot.snapshot.city,
        region: snapshot.snapshot.region,
      });

      const task = await postReviewTask(config, placeId);
      if (!task.ok) return NextResponse.json({ error: task.error }, { status: 502 });

      return NextResponse.json({
        success: true,
        snapshot: snapshot.snapshot,
        taskId: task.taskId,
      });
    }

    // ── collect: poll the queued task; ~60s on the priority queue ────────────
    if (body.action === "collect") {
      const config = getDataForSeoConfig();
      if (!config) {
        return NextResponse.json({ error: "DataForSEO is not configured." }, { status: 503 });
      }
      if (!body.taskId) {
        return NextResponse.json({ error: "Missing taskId." }, { status: 400 });
      }

      const result = await getReviewTask(config, body.taskId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
      if (result.pending) return NextResponse.json({ success: true, pending: true });

      if (result.reviews.length > 0) {
        // Upsert on Google's own review id so repeat pulls update rather than
        // duplicate, which is what makes new-since-last-run meaningful.
        const { error } = await admin.from("client_reviews").upsert(
          result.reviews.map((review) => ({
            client_id: clientId,
            review_id: review.reviewId,
            rating: review.rating,
            review_text: review.reviewText,
            profile_name: review.profileName,
            reviewed_at: review.reviewedAt,
            owner_answer: review.ownerAnswer,
            local_guide: review.localGuide,
            fetched_at: new Date().toISOString(),
          })),
          { onConflict: "client_id,review_id" },
        );
        if (error) {
          console.error("Storing reviews failed:", error);
          return NextResponse.json({ error: "Could not store reviews." }, { status: 500 });
        }
      }

      const withText = result.reviews.filter((r) => r.reviewText).length;
      return NextResponse.json({
        success: true,
        pending: false,
        stored: result.reviews.length,
        withText,
      });
    }

    // ── report: synthesise stored reviews into the brand read ───────────────
    if (body.action === "report") {
      const [{ data: snapshot }, { data: reviews }] = await Promise.all([
        supabase
          .from("client_reputation_snapshots")
          .select("*")
          .eq("client_id", clientId)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("client_reviews")
          .select("rating, review_text, reviewed_at")
          .eq("client_id", clientId)
          .order("reviewed_at", { ascending: false })
          .limit(700),
      ]);

      const report = await generateReputationReport({
        practiceName: snapshot?.title ?? client.account_name,
        rating: snapshot?.rating ?? null,
        votesCount: snapshot?.votes_count ?? null,
        ratingDistribution: (snapshot?.rating_distribution ?? {}) as Record<string, number>,
        placeTopics: (snapshot?.place_topics ?? {}) as Record<string, number>,
        reviews: (reviews ?? []).map((row) => ({
          rating: row.rating,
          reviewText: row.review_text,
          reviewedAt: row.reviewed_at,
        })),
      });

      const { data: saved, error } = await admin
        .from("client_reputation_reports")
        .insert({
          client_id: clientId,
          generated_by: user.email ?? null,
          model: report.model,
          review_count: report.reviewCount,
          report_markdown: report.markdown,
        })
        .select("*")
        .single();
      if (error) {
        console.error("Storing report failed:", error);
        return NextResponse.json({ error: "Could not store the report." }, { status: 500 });
      }

      return NextResponse.json({ success: true, report: saved });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Reputation action failed:", error);
    const message =
      error instanceof Error ? error.message : "Reputation request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
