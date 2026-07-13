import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ILLUMINARE_CLIENT_COLUMNS,
  ILLUMINARE_CLIENT_STATUSES,
  ILLUMINARE_ENGAGEMENT_TYPES,
  type IlluminareClientStatus,
  type IlluminareEngagementType,
} from "@/lib/illuminare/types";

type PatchBody = {
  accountLead?: string | null;
  status?: IlluminareClientStatus;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  engagementType?: IlluminareEngagementType | null;
  scopeSummary?: string | null;
  retainerNotes?: string | null;
  goals?: string | null;
  strategy?: string | null;
  progressNotes?: string | null;
  notes?: string | null;
};

// Maps camelCase request keys to DB columns; each returns the normalized value.
const TEXT_FIELDS: Record<string, string> = {
  accountLead: "account_lead",
  website: "website",
  contactName: "contact_name",
  contactEmail: "contact_email",
  scopeSummary: "scope_summary",
  retainerNotes: "retainer_notes",
  goals: "goals",
  strategy: "strategy",
  progressNotes: "progress_notes",
  notes: "notes",
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
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

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const [key, column] of Object.entries(TEXT_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      patch[column] = cleanText(body[key as keyof PatchBody]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (!body.status || !ILLUMINARE_CLIENT_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }

  if (Object.prototype.hasOwnProperty.call(body, "engagementType")) {
    const value = body.engagementType;
    if (value != null && !ILLUMINARE_ENGAGEMENT_TYPES.includes(value)) {
      return NextResponse.json({ error: "Invalid engagement type" }, { status: 400 });
    }
    patch.engagement_type = value ?? null;
  }

  const { data, error } = await supabase
    .from("illuminare_clients")
    .update(patch)
    .eq("id", id)
    .select(ILLUMINARE_CLIENT_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  return NextResponse.json({ client: data });
}
