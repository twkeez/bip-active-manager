import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEmail } from "@/lib/auth/allowed-domain";
import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/lib/mcp-oauth/core";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // A return path set by the login page (e.g. the Claude connector's consent
  // screen), else the one in the URL. Only a same-site path is ever used:
  // "@evil.com" or "//evil.com" would otherwise send the person off-site.
  const returnCookie = request.cookies.get("bip_return_to")?.value;
  const next = safeReturnPath(returnCookie ? decodeURIComponent(returnCookie) : searchParams.get("next"));

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
      const response = NextResponse.redirect(`${origin}${next}`);
      if (returnCookie) response.cookies.set("bip_return_to", "", { path: "/", maxAge: 0 });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
