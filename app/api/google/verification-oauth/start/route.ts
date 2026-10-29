import { NextResponse } from "next/server";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { generateOAuthState } from "@/lib/google/oauth";
import { buildVerificationAuthorizationUrl, VERIFICATION_FLOW, VERIFICATION_FLOW_COOKIE } from "@/lib/google/verification-connection";
import { createClient } from "@/lib/supabase/server";

/** Starts the admin-only Google connection used for Search Console access (see lib/google/verification-connection.ts). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const appOrigin = `${url.protocol}//${url.host}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), 302);
  if (!isAdmin(await getProfile(supabase))) return NextResponse.redirect(new URL("/", request.url), 302);

  const state = generateOAuthState();
  const redirect = NextResponse.redirect(buildVerificationAuthorizationUrl(state, appOrigin), 302);
  const cookie = { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: 10 * 60 };
  redirect.cookies.set("google_oauth_state", state, cookie);
  redirect.cookies.set(VERIFICATION_FLOW_COOKIE, VERIFICATION_FLOW, cookie);
  return redirect;
}
