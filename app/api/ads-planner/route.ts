import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildUrlAdsPlanPrompt, urlAdsPlanOutputFormat, type UrlAdsPlan } from "@/lib/ads/url-ads-plan";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { VET_ONBOARDING_MODEL } from "@/lib/vet-onboarding/anthropic-model";

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    return new URL(withProto).toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(supabase);
  if (!isAdmin(profile)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });

  let body: { url?: string; city?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const url = normalizeUrl(body.url ?? "");
  if (!url) return NextResponse.json({ error: "Enter a valid website URL." }, { status: 400 });

  // Same Best Practices constants the onboarding planner uses — single source of truth.
  const { data: bpRows } = await supabase
    .from("best_practices")
    .select("key, content")
    .in("key", ["ppc_campaign_skeleton", "ppc_negatives"]);
  const bp = new Map((bpRows ?? []).map((r) => [r.key as string, (r.content as string | null) ?? ""]));
  const skeleton = bp.get("ppc_campaign_skeleton") ?? "";
  const constantNegatives = (bp.get("ppc_negatives") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.parse({
      model: VET_ONBOARDING_MODEL,
      max_tokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        {
          role: "user",
          content: buildUrlAdsPlanPrompt({ url, city: (body.city ?? "").trim(), skeleton }),
        },
      ],
      output_config: { format: urlAdsPlanOutputFormat },
    });
    const parsed = message.parsed_output as
      | {
          practiceSummary?: UrlAdsPlan["practiceSummary"];
          adGroups?: UrlAdsPlan["adGroups"];
          budgetNotes?: string;
          addedNegatives?: string[];
        }
      | null;

    const negatives = [
      ...new Set([...constantNegatives, ...(parsed?.addedNegatives ?? [])].map((n) => n.trim()).filter(Boolean)),
    ];
    const plan: UrlAdsPlan = {
      practiceSummary: parsed?.practiceSummary ?? { name: "", location: "", services: "" },
      adGroups: parsed?.adGroups ?? [],
      budgetNotes: parsed?.budgetNotes ?? "",
      negatives,
    };
    return NextResponse.json({ plan, universalCount: constantNegatives.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ads plan failed" },
      { status: 500 },
    );
  }
}
