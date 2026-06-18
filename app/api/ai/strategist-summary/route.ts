import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateClaudeText } from "@/lib/ai/claude";
import type {
  GscPageMetric,
  GscSnapshot,
  SocialDailySnapshot,
  StrategistSummaryResult,
} from "@/lib/types/client";

type StrategistSummaryRequestBody = {
  clientId?: number;
  goals?: string;
};

function isoDateDaysAgo(days: number) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function safeParseSummary(text: string): StrategistSummaryResult | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const jsonCandidate = fenced?.[1] ?? trimmed;
  try {
    const parsed = JSON.parse(jsonCandidate) as Partial<StrategistSummaryResult>;
    if (
      typeof parsed.theWin === "string" &&
      typeof parsed.theConcern === "string" &&
      typeof parsed.theNextMove === "string"
    ) {
      return {
        theWin: parsed.theWin.trim(),
        theConcern: parsed.theConcern.trim(),
        theNextMove: parsed.theNextMove.trim(),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: StrategistSummaryRequestBody;
  try {
    body = (await request.json()) as StrategistSummaryRequestBody;
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
    .select("id,account_name,website")
    .eq("id", clientId)
    .single<{ id: number; account_name: string; website: string | null }>();
  if (clientError || !clientRow) {
    return NextResponse.json(
      { error: clientError?.message ?? "Client not found" },
      { status: 404 },
    );
  }

  const { data: latestGscSnapshot } = await admin
    .from("client_gsc_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GscSnapshot>();
  const { data: gscPageRows } = latestGscSnapshot
    ? await admin
        .from("client_gsc_page_metrics")
        .select("*")
        .eq("snapshot_id", latestGscSnapshot.id)
        .returns<GscPageMetric[]>()
    : { data: [] as GscPageMetric[] };

  const socialCutoff = isoDateDaysAgo(30);
  const { data: socialRows } = await admin
    .from("client_social_daily_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .eq("platform", "facebook")
    .gte("snapshot_date", socialCutoff)
    .returns<SocialDailySnapshot[]>();

  const gscClicks = (gscPageRows ?? []).reduce((sum, row) => sum + row.clicks, 0);
  const gscImpressions = (gscPageRows ?? []).reduce((sum, row) => sum + row.impressions, 0);
  const gscCtr =
    gscImpressions > 0
      ? ((gscClicks / gscImpressions) * 100).toFixed(2)
      : "0.00";
  const fbEngagement = (socialRows ?? []).reduce(
    (sum, row) => sum + (row.engagement ?? 0),
    0,
  );
  const fbReach = (socialRows ?? []).reduce((sum, row) => sum + (row.reach ?? 0), 0);
  const fbImpressions = (socialRows ?? []).reduce(
    (sum, row) => sum + (row.impressions ?? 0),
    0,
  );
  const goals =
    (body.goals ?? "").trim() || "Increase qualified veterinary appointments.";

  const prompt = [
    "You are a veteran Veterinary Marketing Strategist for Beyond Indigo Pets.",
    "Write concise, practical monthly reporting bullets for an account manager.",
    "",
    `Client: ${clientRow.account_name}`,
    `Website: ${clientRow.website ?? "N/A"}`,
    `Client goals: ${goals}`,
    "",
    "30-day Search Console data:",
    `- Clicks: ${gscClicks}`,
    `- Impressions: ${gscImpressions}`,
    `- CTR: ${gscCtr}%`,
    "",
    "30-day Facebook data:",
    `- Engagement: ${fbEngagement}`,
    `- Reach: ${fbReach}`,
    `- Impressions: ${fbImpressions}`,
    "",
    "Return STRICT JSON only with these keys:",
    '{ "theWin": "...", "theConcern": "...", "theNextMove": "..." }',
    "Each value should be one sentence, no markdown.",
  ].join("\n");

  try {
    const text = await generateClaudeText(prompt);
    const parsed = safeParseSummary(text);
    if (!parsed) {
      throw new Error("Gemini did not return valid summary JSON.");
    }
    return NextResponse.json({
      ok: true,
      summary: parsed,
      sourceData: {
        goals,
        gsc: {
          clicks: gscClicks,
          impressions: gscImpressions,
          ctrPercent: Number(gscCtr),
          snapshotUpdatedAt: latestGscSnapshot?.updated_at ?? null,
        },
        facebook: {
          engagement: fbEngagement,
          reach: fbReach,
          impressions: fbImpressions,
          daysIncluded: socialRows?.length ?? 0,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate strategist summary.",
      },
      { status: 500 },
    );
  }
}
