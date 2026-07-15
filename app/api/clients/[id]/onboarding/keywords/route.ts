import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildOnboardingEvaluations } from "@/lib/clients/onboarding";
import { seoKeywordAllowance, suggestSeoKeywords } from "@/lib/playbook/client-tiers";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

async function loadClient(supabase: Awaited<ReturnType<typeof createClient>>, clientId: number) {
  const { data } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  return (data as ClientRow | null) ?? null;
}

// Suggest tier-sized keywords + return the client's current tracked ones.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const clientId = parseClientId(id);
  if (!clientId) return NextResponse.json({ error: "Invalid client id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await loadClient(supabase, clientId);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { data: existingRows } = await supabase
    .from("client_keyword_targets")
    .select("keyword")
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId)
    .eq("is_active", true);

  return NextResponse.json({
    allowance: seoKeywordAllowance(client),
    suggestions: suggestSeoKeywords(client),
    existing: (existingRows ?? []).map((r) => r.keyword as string),
  });
}

// Replace the client's tracked keywords with the provided list.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const clientId = parseClientId(id);
  if (!clientId) return NextResponse.json({ error: "Invalid client id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await loadClient(supabase, clientId);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  let keywords: string[] = [];
  try {
    const body = (await request.json()) as { keywords?: string[] };
    keywords = Array.isArray(body.keywords) ? body.keywords : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const cleaned = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))].slice(
    0,
    Math.max(0, seoKeywordAllowance(client)),
  );

  // Replace the active set for this client.
  await supabase
    .from("client_keyword_targets")
    .delete()
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId);

  if (cleaned.length > 0) {
    const rows = cleaned.map((keyword, index) => ({
      owner_user_id: user.id,
      client_id: clientId,
      keyword,
      tag: null,
      priority: cleaned.length - index,
      is_active: true,
    }));
    const { error: insertError } = await supabase.from("client_keyword_targets").insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const [evaluation] = await buildOnboardingEvaluations(supabase, user.id, [client]);
  return NextResponse.json({ ok: true, evaluation, saved: cleaned });
}
