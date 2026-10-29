import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleAuthorizationUrl, generateOAuthState } from "@/lib/google/oauth";
import { VERIFICATION_FLOW_COOKIE } from "@/lib/google/verification-connection";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appOrigin = `${url.protocol}//${url.host}`;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 302);
  }

  const state = generateOAuthState();
  const redirect = NextResponse.redirect(buildGoogleAuthorizationUrl(state, appOrigin), 302);
  const isHttps = url.protocol === "https:";
  redirect.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  // A leftover cookie from an abandoned site-verification connect would send this one to the wrong place.
  redirect.cookies.delete(VERIFICATION_FLOW_COOKIE);
  return redirect;
}
