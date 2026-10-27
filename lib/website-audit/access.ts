import { NextResponse } from "next/server";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

/** Website audits spend on paid APIs: admins only for now. */
export async function requireAuditAdmin(): Promise<{ email: string } | { error: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdmin(await getProfile(supabase))) return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  return { email: user.email ?? "" };
}
