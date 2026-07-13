import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getIlluminareBasecampOAuthConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { buildIlluminareBasecampAuthorizationUrl } from "@/lib/illuminare/basecamp-auth";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let internalDomains: string[] = [];
  try {
    ({ internalDomains } = getIlluminareBasecampOAuthConfig());
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_config_error";
    const reason = message.includes("ILLUMINARE_BASECAMP_CLIENT_ID")
      ? "missing_oauth_env"
      : "oauth_config_error";
    return NextResponse.redirect(
      new URL(`/illuminare?basecamp=${reason}`, request.url),
    );
  }

  // The app is already gated to internal Google sign-in, so only enforce the
  // email-domain allowlist when INTERNAL_EMAIL_DOMAINS is actually configured.
  const emailDomain = user.email?.toLowerCase().split("@")[1] ?? "";
  if (internalDomains.length > 0 && !internalDomains.includes(emailDomain)) {
    return NextResponse.redirect(
      new URL("/illuminare?basecamp=forbidden", request.url),
    );
  }

  const state = randomUUID();
  const isHttps = new URL(request.url).protocol === "https:";
  const redirect = NextResponse.redirect(
    buildIlluminareBasecampAuthorizationUrl(state),
    302,
  );
  redirect.cookies.set("illuminare_basecamp_oauth_state", state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return redirect;
}
