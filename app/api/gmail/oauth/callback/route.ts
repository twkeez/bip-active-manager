import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForGmailToken } from "@/lib/gmail/oauth";
import { saveGmailToken } from "@/lib/gmail/token-manager";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appOrigin = `${url.protocol}//${url.host}`;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gmail_oauth_state")?.value;

  const fail = (reason: string) => {
    const response = NextResponse.redirect(
      `${appOrigin}/my-tasks?gmail=${encodeURIComponent(reason)}`,
      302,
    );
    response.cookies.delete("gmail_oauth_state");
    return response;
  };

  if (!code || !state || !expectedState || state !== expectedState) {
    return fail("oauth_state_error");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return fail("unauthorized");
  }

  try {
    const token = await exchangeCodeForGmailToken(code);
    await saveGmailToken(createAdminClient(), {
      userId: user.id,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scope: token.scope,
      tokenType: token.tokenType,
      source: "oauth_exchange",
    });
    const success = NextResponse.redirect(`${appOrigin}/my-tasks?gmail=connected`, 302);
    success.cookies.delete("gmail_oauth_state");
    return success;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "oauth_failed");
  }
}
