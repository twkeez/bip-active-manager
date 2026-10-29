import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForGoogleToken } from "@/lib/google/oauth";
import { saveGoogleToken } from "@/lib/google/token-manager";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { saveVerificationToken, VERIFICATION_FLOW, VERIFICATION_FLOW_COOKIE } from "@/lib/google/verification-connection";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appOrigin = `${url.protocol}//${url.host}`;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;

  // Where to redirect after — settings tab in cockpit
  const successUrl = `${appOrigin}/dashboard/cockpit?google=connected`;
  const failUrl = (reason: string) => `${appOrigin}/dashboard/cockpit?google=${encodeURIComponent(reason)}`;

  const fail = (reason: string) => {
    const response = NextResponse.redirect(failUrl(reason), 302);
    response.cookies.delete("google_oauth_state");
    return response;
  };

  if (!code || !state || !expectedState || state !== expectedState) {
    return fail("oauth_state_error");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  // The admin-only site-verification connection comes back through here too;
  // it is stored separately and never replaces the everyday Google connection.
  if (cookieStore.get(VERIFICATION_FLOW_COOKIE)?.value === VERIFICATION_FLOW) {
    const page = `${appOrigin}/search-console-access`;
    const done = (query: string) => {
      const response = NextResponse.redirect(`${page}?${query}`, 302);
      response.cookies.delete("google_oauth_state");
      response.cookies.delete(VERIFICATION_FLOW_COOKIE);
      return response;
    };
    if (!isAdmin(await getProfile(supabase))) return done("error=admins_only");
    try {
      const token = await exchangeCodeForGoogleToken(code, appOrigin);
      const who = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${token.accessToken}` } })
        .then((r) => (r.ok ? (r.json() as Promise<{ email?: string }>) : null))
        .catch(() => null);
      await saveVerificationToken(createAdminClient(), {
        userId: user.id,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        scope: token.scope,
        email: who?.email ?? null,
      });
      return done("connected=1");
    } catch (error) {
      return done(`error=${encodeURIComponent(error instanceof Error ? error.message : "oauth_failed")}`);
    }
  }

  try {
    const token = await exchangeCodeForGoogleToken(code, appOrigin);
    await saveGoogleToken(createAdminClient(), {
      userId: user.id,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scope: token.scope,
      source: "oauth_exchange",
    });
    const success = NextResponse.redirect(successUrl, 302);
    success.cookies.delete("google_oauth_state");
    return success;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "oauth_failed");
  }
}
