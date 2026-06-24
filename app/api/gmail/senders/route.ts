import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";

type SenderRow = { from_email: string | null; from_name: string | null };

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_email_messages")
    .select("from_email, from_name")
    .eq("owner_user_id", user.id)
    .not("from_email", "is", null)
    .order("internal_date", { ascending: false, nullsFirst: false })
    .limit(2000);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Distinct by email (lowercased); keep the first (most recent) name we see.
  const byEmail = new Map<string, { email: string; name: string | null }>();
  for (const row of (data ?? []) as SenderRow[]) {
    const email = (row.from_email ?? "").trim().toLowerCase();
    if (!email) continue;
    if (!byEmail.has(email)) {
      byEmail.set(email, { email, name: row.from_name?.trim() || null });
    }
  }

  const senders = [...byEmail.values()].sort((a, b) =>
    (a.name ?? a.email).localeCompare(b.name ?? b.email),
  );
  return NextResponse.json({ senders });
}
