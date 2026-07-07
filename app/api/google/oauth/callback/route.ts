import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForGoogleToken } from "@/lib/google/oauth";
import { saveGoogleToken } from "@/lib/google/token-manager";

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
