import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DELIVERABLE_CADENCES,
  type DeliverableCadence,
  type DeliverableKind,
} from "@/lib/illuminare/deliverables";

type CreateBody = {
  clientId?: number;
  title?: string;
  detail?: string | null;
  kind?: DeliverableKind;
  cadence?: DeliverableCadence | null;
  startDate?: string | null;
  dueDate?: string | null;
  followUpIntervalDays?: number | null;
  notes?: string | null;
};

const DELIVERABLE_COLUMNS =
  "id, client_id, title, detail, kind, cadence, status, start_date, due_date, completed_at, follow_up_interval_days, follow_up_at, last_followed_up_at, notes, created_at, updated_at";

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeInterval(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = Number(new URL(request.url).searchParams.get("clientId"));
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("illuminare_deliverables")
    .select(DELIVERABLE_COLUMNS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deliverables: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = Number(body.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid clientId" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const kind: DeliverableKind = body.kind === "recurring" ? "recurring" : "one_time";
  const cadence =
    kind === "recurring" &&
    body.cadence &&
    DELIVERABLE_CADENCES.includes(body.cadence)
      ? body.cadence
      : null;

  // The client this deliverable belongs to must exist.
  const { data: client } = await supabase
    .from("illuminare_clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("illuminare_deliverables")
    .insert({
      client_id: clientId,
      title,
      detail:
        typeof body.detail === "string" && body.detail.trim() !== ""
          ? body.detail.trim()
          : null,
      kind,
      cadence,
      status: "active",
      start_date: normalizeDate(body.startDate),
      due_date: kind === "one_time" ? normalizeDate(body.dueDate) : null,
      follow_up_interval_days:
        kind === "one_time" ? normalizeInterval(body.followUpIntervalDays) : null,
      notes:
        typeof body.notes === "string" && body.notes.trim() !== ""
          ? body.notes.trim()
          : null,
    })
    .select(DELIVERABLE_COLUMNS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create deliverable" },
      { status: 500 },
    );
  }
  return NextResponse.json({ deliverable: data });
}
