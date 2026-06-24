import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/require-admin";
import {
  buildGmailAuthorizationUrl,
  generateOAuthState,
} from "@/lib/gmail/oauth";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 302);
  }
  if (!(await isAdmin(supabase))) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 302);
  }

  const state = generateOAuthState();
  const redirect = NextResponse.redirect(buildGmailAuthorizationUrl(state), 302);
  const isHttps = new URL(request.url).protocol === "https:";
  redirect.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return redirect;
}
