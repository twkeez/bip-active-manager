import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientActiveServices } from "@/lib/clients/service-active";
import {
  assembleKickoffBody,
  kickoffThreadTitle,
  quarterLabel,
  type KickoffBlock,
} from "@/lib/clients/onboarding-kickoff";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

type KickoffOverride = { custom_title: string | null; custom_body: string | null };

async function loadContext(supabase: Awaited<ReturnType<typeof createClient>>, clientId: number) {
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle<ClientRow>();
  if (error) throw new Error(error.message);
  if (!client) return null;

  const { data: blocksData } = await supabase
    .from("onboarding_kickoff_blocks")
    .select("block_key, body, sort_order")
    .order("sort_order", { ascending: true });

  const defaultTitle = kickoffThreadTitle();
  const defaultBody = assembleKickoffBody((blocksData ?? []) as KickoffBlock[], {
    clientName: client.account_name,
    strategist: client.marketing_strategist?.trim() || "your strategist",
    quarterLabel: quarterLabel(),
    activeServices: getClientActiveServices(client),
  });
  return { client, defaultTitle, defaultBody };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const clientId = parseClientId(id);
  if (!clientId) return NextResponse.json({ error: "Invalid client id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let ctx;
  try {
    ctx = await loadContext(supabase, clientId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
  if (!ctx) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { data: override } = await supabase
    .from("client_onboarding_kickoff")
    .select("custom_title, custom_body")
    .eq("client_id", clientId)
    .maybeSingle<KickoffOverride>();

  const isOverride = Boolean(override?.custom_body);
  return NextResponse.json({
    title: override?.custom_title || ctx.defaultTitle,
    body: isOverride ? override!.custom_body : ctx.defaultBody,
    defaultTitle: ctx.defaultTitle,
    defaultBody: ctx.defaultBody,
    isOverride,
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const clientId = parseClientId(id);
  if (!clientId) return NextResponse.json({ error: "Invalid client id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("client_onboarding_kickoff").upsert(
    {
      client_id: clientId,
      custom_title: typeof body.title === "string" ? body.title : null,
      custom_body: typeof body.body === "string" ? body.body : null,
      updated_at: now,
    },
    { onConflict: "client_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const clientId = parseClientId(id);
  if (!clientId) return NextResponse.json({ error: "Invalid client id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("client_onboarding_kickoff")
    .delete()
    .eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
