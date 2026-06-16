import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildReportingMetricControls,
  isValidReportingMetricId,
  type ReportingMetricId,
} from "@/lib/reporting/metric-registry";
import type { ClientReportingMetricPreference } from "@/lib/types/client";

type PreferenceBody = {
  clientId?: number;
  rows?: Array<{
    metricId?: string;
    isEnabled?: boolean;
    displayOrder?: number;
  }>;
};

function parseClientId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeDisplayOrder(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.round(parsed));
}

async function listRows(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, clientId: number) {
  const { data, error } = await supabase
    .from("client_reporting_metric_preferences")
    .select("*")
    .eq("owner_user_id", userId)
    .eq("client_id", clientId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    return { rows: null, error: error.message };
  }
  return { rows: (data ?? []) as ClientReportingMetricPreference[], error: null };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = parseClientId(url.searchParams.get("clientId"));
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }
  const { rows, error } = await listRows(supabase, user.id, clientId);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ rows });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PreferenceBody;
  try {
    body = (await request.json()) as PreferenceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = parseClientId(body.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  const controls = buildReportingMetricControls([]);
  const fallbackOrder = new Map<ReportingMetricId, number>(
    controls.map((control) => [control.metricId, control.displayOrder]),
  );
  const rows = (body.rows ?? [])
    .map((row) => {
      if (!isValidReportingMetricId(row.metricId)) return null;
      const fallback = fallbackOrder.get(row.metricId) ?? 1000;
      return {
        owner_user_id: user.id,
        client_id: clientId,
        metric_id: row.metricId,
        is_enabled: Boolean(row.isEnabled),
        display_order: normalizeDisplayOrder(row.displayOrder, fallback),
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("client_reporting_metric_preferences")
      .upsert(rows, { onConflict: "owner_user_id,client_id,metric_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = await listRows(supabase, user.id, clientId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ rows: result.rows ?? [] });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { clientId?: number };
  try {
    body = (await request.json()) as { clientId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = parseClientId(body.clientId);
  if (!clientId) {
    return NextResponse.json({ error: "Valid clientId is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("client_reporting_metric_preferences")
    .delete()
    .eq("owner_user_id", user.id)
    .eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: [] });
}
