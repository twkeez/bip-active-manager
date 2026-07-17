import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { isSyncableAdsCustomerId, normalizeCustomerId } from "@/lib/ads/customer-id";
import { buildRsaPrompt, clampRsa, rsaDraftOutputFormat, type RsaDraft } from "@/lib/ads/draft-rsa";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { VET_ONBOARDING_MODEL } from "@/lib/vet-onboarding/anthropic-model";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI drafting is not configured." }, { status: 500 });

  let body: { customerId?: string; campaign?: string; keywords?: string[]; weakInput?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const customerId = normalizeCustomerId(body.customerId ?? "");
  const weakInput = body.weakInput === "expected_ctr" ? "expected_ctr" : "ad_relevance";
  if (!isSyncableAdsCustomerId(customerId)) {
    return NextResponse.json({ error: "Invalid customer ID." }, { status: 400 });
  }

  // Pull practice name + city from the client that owns this ad account.
  const { data: client } = await supabase
    .from("clients")
    .select("account_name, city")
    .eq("ads_customer_id", customerId)
    .maybeSingle();

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.parse({
      model: VET_ONBOARDING_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: buildRsaPrompt({
            practiceName: (client?.account_name as string | undefined) ?? "the practice",
            city: (client?.city as string | undefined) ?? "",
            campaign: body.campaign ?? "Search",
            keywords: Array.isArray(body.keywords) ? body.keywords.slice(0, 12) : [],
            weakInput,
          }),
        },
      ],
      output_config: { format: rsaDraftOutputFormat },
    });
    const draft = clampRsa(message.parsed_output as RsaDraft | null);
    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ad copy draft failed" },
      { status: 500 },
    );
  }
}
