import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateGeminiText } from "@/lib/ai/gemini";

type KeywordDropTheoryRequestBody = {
  clientId?: number;
  keyword?: string;
  pageUrl?: string;
  previousPosition?: number | null;
  currentPosition?: number | null;
  currentClicks?: number;
  previousClicks?: number;
  currentImpressions?: number;
  previousImpressions?: number;
};

type KeywordDropTheoryResult = {
  theory: string;
  actionSignals: string[];
};

function parseTheoryResponse(text: string): KeywordDropTheoryResult | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const jsonCandidate = fenced?.[1] ?? trimmed;
  try {
    const parsed = JSON.parse(jsonCandidate) as Partial<KeywordDropTheoryResult>;
    if (
      typeof parsed.theory === "string" &&
      Array.isArray(parsed.actionSignals) &&
      parsed.actionSignals.every((item) => typeof item === "string")
    ) {
      return {
        theory: parsed.theory.trim(),
        actionSignals: parsed.actionSignals.slice(0, 3).map((item) => item.trim()),
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

  let body: KeywordDropTheoryRequestBody;
  try {
    body = (await request.json()) as KeywordDropTheoryRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = Number(body.clientId);
  const keyword = (body.keyword ?? "").trim();
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }
  if (!keyword) {
    return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
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

  const prompt = [
    "You are a senior SEO strategist for veterinary practices.",
    "Given this keyword ranking drop, provide a concise 2-sentence SEO theory.",
    "Then identify up to 3 likely high-value action signals from this set:",
    "- Cannibalization",
    "- Search Intent Shift",
    "- New Competitor",
    "",
    `Client: ${clientRow.account_name}`,
    `Website: ${clientRow.website ?? "N/A"}`,
    `Keyword: ${keyword}`,
    `Landing page URL: ${(body.pageUrl ?? "").trim() || "Unknown"}`,
    `Previous avg position: ${body.previousPosition ?? "Unknown"}`,
    `Current avg position: ${body.currentPosition ?? "Unknown"}`,
    `Previous clicks: ${body.previousClicks ?? 0}`,
    `Current clicks: ${body.currentClicks ?? 0}`,
    `Previous impressions: ${body.previousImpressions ?? 0}`,
    `Current impressions: ${body.currentImpressions ?? 0}`,
    "",
    "Return STRICT JSON only:",
    '{ "theory": "Two concise sentences.", "actionSignals": ["Cannibalization"] }',
  ].join("\n");

  try {
    const text = await generateGeminiText(prompt);
    const parsed = parseTheoryResponse(text);
    if (!parsed) {
      throw new Error("Gemini did not return valid theory JSON.");
    }
    return NextResponse.json({ ok: true, result: parsed });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate keyword drop theory.",
      },
      { status: 500 },
    );
  }
}
