import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/profile";

type RoleBody = {
  userId?: string;
  role?: "admin" | "strategist";
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: RoleBody;
  try {
    body = (await req.json()) as RoleBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userId = (body.userId ?? "").trim();
  const role: "admin" | "strategist" = body.role === "admin" ? "admin" : "strategist";
  if (!userId) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

  const admin = createAdminClient();

  // Guard: never remove the last admin (prevents lockout).
  if (role === "strategist") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    const { data: target } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle<{ role: string }>();
    if (target?.role === "admin" && (count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Can't demote the last remaining admin." },
        { status: 400 },
      );
    }
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, userId, role });
}
