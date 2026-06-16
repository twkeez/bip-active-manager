import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserEmailMessageRow } from "@/lib/gmail/types";

function parseIntParam(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const view = (url.searchParams.get("view") ?? "inbox").trim().toLowerCase();
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = parseIntParam(url.searchParams.get("limit"), 50, 100);
  const offset = Math.max(0, parseIntParam(url.searchParams.get("offset"), 0, 5000));

  let query = supabase
    .from("user_email_messages")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("internal_date", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (view === "high_priority") {
    query = query.eq("is_high_priority", true).neq("triage_status", "deleted");
  } else if (view === "needs_action") {
    query = query.eq("needs_action", true).neq("triage_status", "deleted");
  } else if (view === "deleted") {
    query = query.eq("triage_status", "deleted");
  } else if (view === "archived") {
    query = query.eq("triage_status", "archived");
  } else {
    query = query.neq("triage_status", "deleted");
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  let rows = (data ?? []) as UserEmailMessageRow[];
  if (q) {
    rows = rows.filter((row) =>
      [row.subject, row.snippet, row.from_email, row.from_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }
  return NextResponse.json({ rows });
}
