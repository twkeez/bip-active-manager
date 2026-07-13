import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Assignment = { clientId?: number; projectId?: string | null };
type Body = { assignments?: Assignment[] };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.assignments)) {
    return NextResponse.json({ error: "assignments must be an array" }, { status: 400 });
  }

  let updated = 0;
  for (const assignment of body.assignments) {
    const clientId = Number(assignment.clientId);
    if (!Number.isInteger(clientId) || clientId <= 0) continue;
    const projectId =
      typeof assignment.projectId === "string" && assignment.projectId.trim() !== ""
        ? assignment.projectId.trim()
        : null;

    const { error } = await supabase
      .from("illuminare_clients")
      .update({ basecamp_project_id: projectId, updated_at: new Date().toISOString() })
      .eq("id", clientId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}
