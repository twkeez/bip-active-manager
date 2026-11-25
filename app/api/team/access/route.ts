import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth/guard";
import { GRANTABLE_SECTIONS, parseGrants } from "@/lib/auth/sections";
import { createAdminClient } from "@/lib/supabase/admin";

// Saves the sections an admin opened for one strategist (lib/auth/sections.ts).
// Only sections that are ready can be granted; admins hold everything already.

type AccessBody = { userId?: string; grants?: unknown };

export async function POST(req: Request) {
  const auth = await requireAdminRole();
  if ("response" in auth) return auth.response;

  let body: AccessBody;
  try {
    body = (await req.json()) as AccessBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userId = (body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  if (!Array.isArray(body.grants)) return NextResponse.json({ error: "Missing sections" }, { status: 400 });

  const grants = parseGrants(body.grants);
  const notGrantable = grants.filter((grant) => !GRANTABLE_SECTIONS.includes(grant));
  if (grants.length !== body.grants.length || notGrantable.length > 0) {
    return NextResponse.json({ error: "Only Playbook can be granted for now." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string }>();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "No such person." }, { status: 404 });
  if (target.role !== "strategist") {
    return NextResponse.json({ error: "Admins already have every section." }, { status: 400 });
  }

  const { error } = await admin.from("profiles").update({ section_grants: grants }).eq("id", userId);
  if (error) {
    // 42703: the section_grants migration hasn't been applied yet.
    const message =
      error.code === "42703"
        ? "Section access needs a database update first (migration 20261125190000_profile_section_grants.sql)."
        : error.message;
    return NextResponse.json({ error: message }, { status: error.code === "42703" ? 409 : 500 });
  }

  return NextResponse.json({ ok: true, userId, grants });
}
