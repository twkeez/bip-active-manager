import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDataForSeoConfig } from "@/lib/env";
import { buildOnboardingEvaluations } from "@/lib/clients/onboarding";
import { candidateSeoKeywords, seoKeywordAllowance } from "@/lib/playbook/client-tiers";
import { fetchSearchVolumes } from "@/lib/dataforseo/search-volume";
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
    .eq("client_id", clientId)
    .eq("is_active", true);
  const existing = (existingRows ?? []).map((r) => r.keyword as string);

  const allowance = seoKeywordAllowance(client);
  if (allowance === 0) {
    return NextResponse.json({ allowance, candidates: [], existing });
  }

  // Broad candidate pool + any already-tracked keywords, enriched with search
  // volume localized to the practice city, sorted by demand.
  const pool = [...new Set([...candidateSeoKeywords(client), ...existing])];
  const config = getDataForSeoConfig();
  const volumes = config ? await fetchSearchVolumes(config, pool, client.city) : {};
  const candidates = pool
    .map((keyword) => ({ keyword, volume: volumes[keyword.toLowerCase()] ?? null }))
    .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));

  return NextResponse.json({ allowance, candidates, existing });
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

  // Replace the active set for this client. Keyword targets are shared team
  // data, so this replaces everyone's view of them, not just the caller's.
  await supabase
    .from("client_keyword_targets")
    .delete()
    .eq("client_id", clientId);

  if (cleaned.length > 0) {
    const rows = cleaned.map((keyword, index) => ({
      created_by: user.id,
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
