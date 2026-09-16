import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { startOnboardingForClient } from "@/lib/clients/onboarding";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import {
  clientFieldsFromDetails,
  DetailsError,
  intakeFieldsFromDetails,
  parseDetails,
  websiteHost,
} from "@/lib/onboarding/onboarding-details";
import { createClient } from "@/lib/supabase/server";

/**
 * Starting onboarding from a pipeline form.
 *
 * Checks for a client record that already exists before creating one: the
 * roster already has practices stored three, seven and nine times over (Rivertown,
 * Lincoln Hills, Edgewater), which splits their Basecamp and social data. A
 * match by name or website is returned for a person to choose; they can use it,
 * or create a new record deliberately.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    details?: unknown;
    pipelineNotes?: unknown;
    pipelineRaw?: unknown;
    sourceFilename?: unknown;
    useClientId?: unknown;
    createAnyway?: unknown;
  } | null;

  let details;
  try {
    details = parseDetails(body?.details);
  } catch (error) {
    return NextResponse.json({ error: error instanceof DetailsError ? error.message : "Invalid details" }, { status: 400 });
  }

  let clientId: number;
  if (typeof body?.useClientId === "number") {
    clientId = body.useClientId;
    const { error } = await supabase.from("clients").update(clientFieldsFromDetails(details)).eq("id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    if (body?.createAnyway !== true) {
      const target = normalizeClientName(details.accountName);
      const host = websiteHost(details.website);
      const { data: candidates } = await supabase.from("clients").select("id, account_name, website, onboarding_status");
      const matches = (candidates ?? []).filter(
        (row) =>
          normalizeClientName(row.account_name as string) === target ||
          (host && websiteHost(row.website as string | null) === host),
      );
      if (matches.length > 0) {
        return NextResponse.json(
          {
            duplicates: matches.map((row) => ({
              id: row.id,
              name: row.account_name,
              website: row.website,
              onboarding: row.onboarding_status,
            })),
          },
          { status: 409 },
        );
      }
    }
    const { data: created, error } = await supabase
      .from("clients")
      .insert(clientFieldsFromDetails(details))
      .select("id")
      .single();
    if (error || !created) return NextResponse.json({ error: error?.message ?? "Client was not created" }, { status: 500 });
    clientId = created.id as number;
  }

  const now = new Date().toISOString();
  const notes = typeof body?.pipelineNotes === "string" ? body.pipelineNotes.slice(0, 20_000) : null;
  const { error: intakeError } = await supabase.from("client_onboarding_intake").upsert(
    {
      client_id: clientId,
      ...intakeFieldsFromDetails(details),
      ...(notes ? { pipeline_notes: notes } : {}),
      ...(body?.pipelineRaw && typeof body.pipelineRaw === "object" ? { pipeline_raw: body.pipelineRaw } : {}),
      ...(typeof body?.sourceFilename === "string" ? { source_filename: body.sourceFilename.slice(0, 300) } : {}),
      updated_at: now,
    },
    { onConflict: "client_id" },
  );
  if (intakeError) return NextResponse.json({ error: intakeError.message }, { status: 500 });

  // Marks the client as onboarding. Its checklist is still seeded underneath,
  // because Coal Mines and the planning assistant read it; the page does not.
  const { data: status } = await supabase.from("clients").select("onboarding_status").eq("id", clientId).maybeSingle();
  if (status?.onboarding_status !== "active") await startOnboardingForClient(supabase, clientId, user.id);

  return NextResponse.json({ ok: true, clientId });
}
