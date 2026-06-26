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
  const redirectTo = `${origin}/auth/callback?next=/auth/update-password`;

  // Try to create + email the user. The profile row is created by the
  // on_auth_user_created trigger (defaults role='strategist'). If the user
  // already exists, that's fine — we'll just re-issue a set-password link below
  // (this is how we re-onboard people who never finished setting a password).
  let emailed = false;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName || email.split("@")[0] },
    redirectTo,
  });
  if (inviteError) {
    const msg = inviteError.message.toLowerCase();
    const alreadyExists =
      msg.includes("already") || msg.includes("registered") || msg.includes("exists");
    if (!alreadyExists) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }
  } else {
    emailed = true;
  }

  // Apply role / name to the profile (match by id when we just created the user,
  // otherwise by email for an existing one).
  const profilePatch: { role?: "admin" | "strategist"; full_name?: string | null } = {};
  if (role === "admin") profilePatch.role = "admin";
  if (fullName) profilePatch.full_name = fullName;
  if (Object.keys(profilePatch).length > 0) {
    if (invited?.user?.id) {
      await admin.from("profiles").update(profilePatch).eq("id", invited.user.id);
    } else {
      await admin.from("profiles").update(profilePatch).ilike("email", email);
    }
  }

  // Always generate a copyable set-password link so onboarding works even when
  // email delivery is down. generateLink does NOT send an email itself.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    email,
    role,
    emailed,
    actionLink: linkData?.properties?.action_link ?? null,
  });
}
