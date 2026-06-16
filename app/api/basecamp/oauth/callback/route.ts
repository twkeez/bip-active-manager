import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  getBasecampAccountId,
} from "@/lib/basecamp/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("basecamp_oauth_state")?.value;
  const appOrigin = `${url.protocol}//${url.host}`;

  if (!code || !state || !expectedState || state !== expectedState) {
    const fail = NextResponse.redirect(
      `${appOrigin}/dashboard?basecamp=oauth_state_error`,
      302,
    );
    fail.cookies.delete("basecamp_oauth_state");
    return fail;
  }

  try {
    const token = await exchangeCodeForToken(code);
    const accountId = await getBasecampAccountId(token.accessToken);
    const admin = createAdminClient();
    const { error } = await admin.from("basecamp_oauth_tokens").upsert({
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

    const success = NextResponse.redirect(
      `${appOrigin}/dashboard?basecamp=connected`,
      302,
    );
    success.cookies.delete("basecamp_oauth_state");
    return success;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_failed";
    const fail = NextResponse.redirect(
      `${appOrigin}/dashboard?basecamp=${encodeURIComponent(message)}`,
      302,
    );
    fail.cookies.delete("basecamp_oauth_state");
    return fail;
  }
}
