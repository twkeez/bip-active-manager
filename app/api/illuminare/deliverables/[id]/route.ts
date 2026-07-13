import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DELIVERABLE_CADENCES,
  buildCompletionPatch,
  buildFollowUpPatch,
  type DeliverableCadence,
  type IlluminareDeliverableRow,
} from "@/lib/illuminare/deliverables";

const DELIVERABLE_COLUMNS =
  "id, client_id, title, detail, kind, cadence, status, start_date, due_date, completed_at, follow_up_interval_days, follow_up_at, last_followed_up_at, notes, created_at, updated_at";

type PatchBody = {
  // action-based transitions
  action?: "complete" | "followed_up" | "reopen";
  followUpIntervalDays?: number | null;
  // field edits
  title?: string;
  detail?: string | null;
  cadence?: DeliverableCadence | null;
  startDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeInterval(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid deliverable id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("illuminare_deliverables")
    .select(DELIVERABLE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }
  const row = existing as IlluminareDeliverableRow;

  let patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.action === "complete") {
    patch = {
      ...patch,
      ...buildCompletionPatch(
        row,
        Object.prototype.hasOwnProperty.call(body, "followUpIntervalDays")
          ? normalizeInterval(body.followUpIntervalDays)
          : undefined,
      ),
    };
  } else if (body.action === "followed_up") {
    patch = { ...patch, ...buildFollowUpPatch(row) };
  } else if (body.action === "reopen") {
    patch = {
      ...patch,
      status: "active",
      completed_at: null,
      follow_up_at: null,
      last_followed_up_at: null,
    };
  } else {
    // Plain field edits.
    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
      }
      patch.title = title;
    }
    if (Object.prototype.hasOwnProperty.call(body, "detail")) {
      patch.detail =
        typeof body.detail === "string" && body.detail.trim() !== ""
          ? body.detail.trim()
          : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "cadence")) {
      patch.cadence =
        row.kind === "recurring" &&
        body.cadence &&
        DELIVERABLE_CADENCES.includes(body.cadence)
          ? body.cadence
          : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "startDate")) {
      patch.start_date = normalizeDate(body.startDate);
    }
    if (Object.prototype.hasOwnProperty.call(body, "dueDate")) {
      patch.due_date = row.kind === "one_time" ? normalizeDate(body.dueDate) : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "followUpIntervalDays")) {
      patch.follow_up_interval_days = normalizeInterval(body.followUpIntervalDays);
    }
    if (Object.prototype.hasOwnProperty.call(body, "notes")) {
      patch.notes =
        typeof body.notes === "string" && body.notes.trim() !== ""
          ? body.notes.trim()
          : null;
    }
  }

  const { data, error } = await supabase
    .from("illuminare_deliverables")
    .update(patch)
    .eq("id", id)
    .select(DELIVERABLE_COLUMNS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update deliverable" },
      { status: 500 },
    );
  }
  return NextResponse.json({ deliverable: data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid deliverable id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: deleted, error } = await supabase
    .from("illuminare_deliverables")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
