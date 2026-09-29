import { json, oauthErrorResponse, preflight } from "@/lib/mcp-oauth/http";
import { OAuthError, exchangeCode, refreshTokens } from "@/lib/mcp-oauth/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function readParams(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value ?? "")]));
  }
  return Object.fromEntries(new URLSearchParams(await request.text()));
}

/** The token endpoint: a sign-in code or a refresh token in, short-lived keys out. */
export async function POST(request: Request) {
  try {
    const params = await readParams(request);
    const admin = createAdminClient();
    if (params.grant_type === "authorization_code") {
      return json(
        await exchangeCode(admin, {
          code: params.code,
          redirectUri: params.redirect_uri,
          clientId: params.client_id,
          codeVerifier: params.code_verifier,
          resource: params.resource,
        }),
      );
    }
    if (params.grant_type === "refresh_token") {
      return json(await refreshTokens(admin, { refreshToken: params.refresh_token, clientId: params.client_id }));
    }
    throw new OAuthError("unsupported_grant_type", "grant_type must be authorization_code or refresh_token.");
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export const OPTIONS = preflight;
