import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getBasecampOAuthConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { buildBasecampAuthorizationUrl } from "@/lib/basecamp/auth";

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
    ({ internalDomains } = getBasecampOAuthConfig());
  } catch (error) {
    const oauthErrorMessage = error instanceof Error ? error.message : "oauth_config_error";
    const reason = oauthErrorMessage.includes("BASECAMP_CLIENT_ID")
      ? "missing_oauth_env"
      : "oauth_config_error";
    return NextResponse.redirect(
      new URL(`/dashboard?basecamp=${reason}`, request.url),
    );
  }
  const emailDomain = user.email?.toLowerCase().split("@")[1] ?? "";
  if (!internalDomains.includes(emailDomain)) {
    return NextResponse.redirect(
      new URL("/dashboard?basecamp=forbidden", request.url),
    );
  }

  const state = randomUUID();
  const isHttps = new URL(request.url).protocol === "https:";
  const redirect = NextResponse.redirect(
    buildBasecampAuthorizationUrl(state),
    302,
  );
  redirect.cookies.set("basecamp_oauth_state", state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return redirect;
}
