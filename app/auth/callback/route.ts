import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEmail } from "@/lib/auth/allowed-domain";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Enforce the Workspace domain: `hd` on the Google request is only a hint,
      // so reject (and clean up) any account that isn't @beyondindigo.com.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !isAllowedEmail(user.email)) {
        await supabase.auth.signOut();
        try {
          // Deleting the auth user cascades the profiles row (ON DELETE CASCADE).
          await createAdminClient().auth.admin.deleteUser(user.id);
        } catch {
          // Best-effort cleanup — the user still can't get in either way.
        }
        return NextResponse.redirect(`${origin}/login?error=domain`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
