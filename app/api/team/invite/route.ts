import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/profile";

type InviteBody = {
  email?: string;
  fullName?: string;
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

  let body: InviteBody;
  try {
    body = (await req.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const fullName = (body.fullName ?? "").trim();
  const role: "admin" | "strategist" = body.role === "admin" ? "admin" : "strategist";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { origin } = new URL(req.url);

  // Send the Supabase invite email. The profile row is created by the
  // on_auth_user_created trigger (defaults role='strategist').
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName || email.split("@")[0] },
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });
  if (inviteError || !invited?.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? "Failed to send invite." },
      { status: 400 },
    );
  }

  // If they were invited as an admin, promote the auto-created profile.
  if (role === "admin") {
    await admin
      .from("profiles")
      .update({ role: "admin", full_name: fullName || null })
      .eq("id", invited.user.id);
  } else if (fullName) {
    await admin.from("profiles").update({ full_name: fullName }).eq("id", invited.user.id);
  }

  return NextResponse.json({ ok: true, email, role });
}
