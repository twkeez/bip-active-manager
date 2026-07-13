import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBasecampAccountId } from "@/lib/basecamp/auth";
import { fetchAllBasecampProjects } from "@/lib/basecamp/client";
import { exchangeIlluminareCodeForToken } from "@/lib/illuminare/basecamp-auth";
import { normalizeClientName } from "@/lib/clients/normalize-name";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("illuminare_basecamp_oauth_state")?.value;
  const appOrigin = `${url.protocol}//${url.host}`;

  function redirectWith(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    const res = NextResponse.redirect(`${appOrigin}/illuminare?${query}`, 302);
    res.cookies.delete("illuminare_basecamp_oauth_state");
    return res;
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWith({ basecamp: "oauth_state_error" });
  }

  try {
    const token = await exchangeIlluminareCodeForToken(code);
    // Throws if the authorized account isn't a current-Basecamp (bc3) account —
    // a useful, immediate diagnostic if the Illuminare login is set up differently.
    const accountId = await getBasecampAccountId(token.accessToken);

    // Diagnostic: how many projects can this login actually see?
    const projects = await fetchAllBasecampProjects(
      token.accessToken,
      accountId,
      normalizeClientName,
    );

    const admin = createAdminClient();
    const { error } = await admin
      .from("illuminare_basecamp_oauth_tokens")
      .upsert({
        id: 1,
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_at: token.expiresAt,
        token_type: token.tokenType,
        scope: token.scope,
        account_id: accountId,
        updated_at: new Date().toISOString(),
      });
    if (error) {
      throw new Error(error.message);
    }

    return redirectWith({
      basecamp: "connected",
      account: accountId,
      projects: String(projects.length),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    return redirectWith({ basecamp: message });
  }
}
