import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeNextDue, isCadence } from "@/lib/site-audit/seo-audit-schedule";
import type {
  ClientSeoAuditSchedule,
  ClientSeoAuditScheduleWithClient,
} from "@/lib/site-audit/seo-audit-types";

type ScheduleJoinRow = ClientSeoAuditSchedule & {
  clients: { account_name: string; marketing_strategist: string | null; website: string | null } | null;
};

function flatten(row: ScheduleJoinRow): ClientSeoAuditScheduleWithClient {
  const { clients, ...schedule } = row;
  return {
    ...schedule,
    account_name: clients?.account_name ?? "Unknown client",
    marketing_strategist: clients?.marketing_strategist ?? null,
    website: clients?.website ?? null,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("client_seo_audit_schedules")
    .select("*, clients(account_name, marketing_strategist, website)")
    .eq("owner_user_id", user.id)
    .order("next_due_at", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const schedules = (data ?? []).map((row) => flatten(row as ScheduleJoinRow));
  return NextResponse.json({ schedules });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { clientId?: number; cadenceMonths?: number; isActive?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const clientId = Number(body.clientId);
  const cadence = Number(body.cadenceMonths);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "A valid clientId is required" }, { status: 400 });
  }
  if (!isCadence(cadence)) {
    return NextResponse.json({ error: "cadenceMonths must be 3 or 6" }, { status: 400 });
  }
  const isActive = body.isActive !== false;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("client_seo_audit_schedules")
    .select("*")
    .eq("client_id", clientId)
    .eq("owner_user_id", user.id)
    .maybeSingle<ClientSeoAuditSchedule>();

  // First enrollment is due now (prompting the initial audit); an existing
  // schedule recomputes from its last completion, else stays due now.
  const nextDue = existing?.last_completed_at
    ? computeNextDue(existing.last_completed_at, cadence)
    : existing?.next_due_at ?? now;

  const { error } = await supabase.from("client_seo_audit_schedules").upsert(
    {
      owner_user_id: user.id,
      client_id: clientId,
      cadence_months: cadence,
      last_completed_at: existing?.last_completed_at ?? null,
      next_due_at: nextDue,
      is_active: isActive,
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
    },
    { onConflict: "client_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data, error: reloadError } = await supabase
    .from("client_seo_audit_schedules")
    .select("*, clients(account_name, marketing_strategist, website)")
    .eq("owner_user_id", user.id)
    .order("next_due_at", { ascending: true, nullsFirst: false });
  if (reloadError) return NextResponse.json({ error: reloadError.message }, { status: 500 });

  const schedules = (data ?? []).map((row) => flatten(row as ScheduleJoinRow));
  return NextResponse.json({ ok: true, schedules });
}
