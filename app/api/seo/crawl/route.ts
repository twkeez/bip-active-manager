import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runQuickSeoCrawl } from "@/lib/seo/crawl";
import type { SeoCrawlIssue, SeoCrawlSnapshot } from "@/lib/types/client";

type CrawlRequestBody = {
  clientId?: number;
};

export const maxDuration = 300;

/** Pages we will fetch at most. Sites larger than this report as truncated. */
const MAX_PAGES = 250;

/**
 * Wall-clock budget for the crawl itself, well inside maxDuration so there is
 * room to write the results. The crawler stops itself at this point and returns
 * what it has — a partial crawl is useful, a killed function is not.
 */
const CRAWL_BUDGET_MS = 240_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CrawlRequestBody;
  try {
    body = (await request.json()) as CrawlRequestBody;
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
    .select("id,website")
    .eq("id", clientId)
    .single<{ id: number; website: string | null }>();
  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }
  if (!clientRow.website?.trim()) {
    return NextResponse.json(
      { error: "Client website is required before running crawl." },
      { status: 400 },
    );
  }

  const { data: createdSnapshot, error: createSnapshotError } = await admin
    .from("client_seo_crawl_snapshots")
    .insert({
      client_id: clientId,
      base_url: clientRow.website.trim(),
      max_urls: 50,
      run_status: "running",
      crawled_urls: 0,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single<SeoCrawlSnapshot>();
  if (createSnapshotError || !createdSnapshot) {
    return NextResponse.json(
      { error: createSnapshotError?.message ?? "Failed to create crawl snapshot" },
      { status: 500 },
    );
  }

  try {
    const crawl = await runQuickSeoCrawl(clientRow.website.trim(), MAX_PAGES, CRAWL_BUDGET_MS);
    const issuesPayload = crawl.issues.map((issue) => ({
      client_id: clientId,
      snapshot_id: createdSnapshot.id,
      rule_id: issue.rule_id,
      severity: issue.severity,
      category: issue.category,
      title: issue.title,
      description: issue.description,
      suggestion: issue.suggestion,
      url: issue.url,
      location: issue.location,
      evidence: issue.evidence,
      occurrence_key: issue.occurrence_key,
    }));
    if (issuesPayload.length > 0) {
      const { error: issuesError } = await admin
        .from("client_seo_crawl_issues")
        .insert(issuesPayload);
      if (issuesError) {
        throw new Error(`Failed to store crawl issues: ${issuesError.message}`);
      }
    }

    const { data: updatedSnapshot, error: updateSnapshotError } = await admin
      .from("client_seo_crawl_snapshots")
      .update({
        base_url: crawl.baseUrl,
        crawled_urls: crawl.crawledUrls,
        pages: crawl.pages,
        schema_gaps: crawl.schemaGaps,
        max_urls: MAX_PAGES,
        stopped_because: crawl.stoppedBecause,
        run_status: "completed",
        error_message: null,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id)
      .select("*")
      .single<SeoCrawlSnapshot>();
    if (updateSnapshotError || !updatedSnapshot) {
      throw new Error(updateSnapshotError?.message ?? "Failed to finalize crawl snapshot");
    }

    const { data: issuesRows } = await admin
      .from("client_seo_crawl_issues")
      .select("*")
      .eq("snapshot_id", createdSnapshot.id)
      .order("created_at", { ascending: false })
      .returns<SeoCrawlIssue[]>();

    return NextResponse.json({
      ok: true,
      snapshot: updatedSnapshot,
      issues: issuesRows ?? [],
    });
  } catch (error) {
    await admin
      .from("client_seo_crawl_snapshots")
      .update({
        run_status: "failed",
        error_message: error instanceof Error ? error.message : "Crawl failed",
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdSnapshot.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Crawl failed" },
      { status: 500 },
    );
  }
}

/**
 * The most recent completed crawl for a client, so the Research tab can show
 * what the site says without re-crawling. Returns nulls rather than a 404 when
 * a client has never been crawled — "not run yet" is a normal state here.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = Number(new URL(request.url).searchParams.get("clientId"));
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: snapshot } = await admin
    .from("client_seo_crawl_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .eq("run_status", "completed")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle<SeoCrawlSnapshot>();

  if (!snapshot) return NextResponse.json({ snapshot: null, issues: [] });

  const { data: issues } = await admin
    .from("client_seo_crawl_issues")
    .select("*")
    .eq("snapshot_id", snapshot.id)
    .returns<SeoCrawlIssue[]>();

  return NextResponse.json({ snapshot, issues: issues ?? [] });
}
