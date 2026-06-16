import { NextResponse } from "next/server";
import { startOnboardingForClient } from "@/lib/clients/onboarding";
import { norm } from "@/lib/clients/service-active";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/types/client";

type ImportBody = {
  projectId?: string;
  projectName?: string;
  marketingStrategist?: string;
  tier?: string;
  seo?: string;
  ppc?: string;
  smm?: string;
  blog?: string;
  orm?: string;
  startOnboarding?: boolean;
};

function inactiveServiceValue() {
  return "N";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  const projectName = body.projectName?.trim();
  if (!projectId || !projectName) {
    return NextResponse.json(
      { error: "projectId and projectName are required" },
      { status: 400 },
    );
  }

  const payload = {
    account_name: projectName,
    marketing_strategist: norm(body.marketingStrategist) || null,
    total_package_hours: null,
    hours_for_strategist: null,
    blog: norm(body.blog) || inactiveServiceValue(),
    smm: norm(body.smm) || inactiveServiceValue(),
    seo: norm(body.seo) || inactiveServiceValue(),
    ppc: norm(body.ppc) || inactiveServiceValue(),
    orm: norm(body.orm) || inactiveServiceValue(),
    ads_customer_id: null,
    ga4_id: null,
    sc_url: null,
    website: null,
    ga4_property_id: null,
    google_place_id: null,
    basecamp_project_id: projectId,
    harvest_project_id: null,
    harvest_client_id: null,
    tier: norm(body.tier) || null,
  };

  const { data: createdRaw, error: insertError } = await supabase
    .from("clients")
    .insert(payload)
    .select("*")
    .single();
  if (insertError || !createdRaw) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create client" },
      { status: 500 },
    );
  }

  const client = createdRaw as ClientRow;
  const shouldStartOnboarding = body.startOnboarding !== false;

  if (shouldStartOnboarding) {
    try {
      await startOnboardingForClient(supabase, client.id, user.id);
    } catch (startError) {
      return NextResponse.json(
        {
          error:
            startError instanceof Error
              ? startError.message
              : "Client created but onboarding failed to start",
          client,
        },
        { status: 500 },
      );
    }
  }

  const { data: refreshedRaw, error: refreshError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", client.id)
    .single();
  if (refreshError || !refreshedRaw) {
    return NextResponse.json({ ok: true, client });
  }

  return NextResponse.json({ ok: true, client: refreshedRaw as ClientRow });
}
