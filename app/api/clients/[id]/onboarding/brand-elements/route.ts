import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractBrandElements } from "@/lib/brand/extract-brand";
import type { ClientRow } from "@/lib/types/client";

function parseClientId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

// Pull best-effort brand elements (logo, hero image, theme color) from the
// client's website for the SMM brand-assets step.
export async function POST(
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

  const { data: clientRaw } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!clientRaw) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const client = clientRaw as ClientRow;
  if (!client.website?.trim()) {
    return NextResponse.json(
      { error: "Add the website URL first (or pull once the site is live)." },
      { status: 400 },
    );
  }

  try {
    const brandElements = await extractBrandElements(client.website.trim());
    const at = new Date().toISOString();
    await supabase.from("client_onboarding_intake").upsert(
      { client_id: clientId, brand_elements: brandElements, brand_elements_at: at, updated_at: at },
      { onConflict: "client_id" },
    );
    return NextResponse.json({ ok: true, brandElements });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Brand pull failed" },
      { status: 500 },
    );
  }
}
