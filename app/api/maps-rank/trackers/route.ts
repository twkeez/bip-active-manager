import { NextResponse } from "next/server";
import { createTracker, type NewTrackerInput } from "@/lib/maps-rank/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuditAdmin } from "@/lib/website-audit/access";

/** Sets up Maps rank tracking for a client. */
export async function POST(request: Request) {
  const auth = await requireAuditAdmin();
  if ("error" in auth) return auth.error;
  let body: NewTrackerInput;
  try {
    body = (await request.json()) as NewTrackerInput;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const tracker = await createTracker(createAdminClient(), body, auth.email);
    return NextResponse.json({ tracker });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't set up the tracker." }, { status: 400 });
  }
}
