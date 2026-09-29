import { headers } from "next/headers";
import { parseAuthorizeParams, type AuthorizeRequest } from "@/lib/mcp-oauth/core";
import { OAuthError, isConnectorUser, resolveClient, type OAuthClient } from "@/lib/mcp-oauth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const AUTHORIZE_PARAMS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "state",
  "code_challenge",
  "code_challenge_method",
  "resource",
  "scope",
] as const;

export async function requestOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host")?.split(",")[0]?.trim() || list.get("host") || "localhost:3000";
  const proto = list.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type AuthorizeCheck =
  | { kind: "invalid"; message: string }
  | { kind: "sign_in" }
  | { kind: "not_allowed"; email: string }
  | { kind: "ready"; request: AuthorizeRequest; client: OAuthClient; user: { id: string; email: string }; origin: string };

/**
 * Everything the consent screen and the Allow button both need to be true:
 * valid parameters, a known client that owns the redirect URI, and a signed-in
 * Beyond Indigo admin. Run again on Allow, so the screen proves nothing alone.
 */
export async function checkAuthorize(params: Record<string, string | undefined>): Promise<AuthorizeCheck> {
  const origin = await requestOrigin();
  const parsed = parseAuthorizeParams(params, origin);
  if (!parsed.ok) return { kind: "invalid", message: parsed.error };
  const admin = createAdminClient();
  let client: OAuthClient;
  try {
    client = await resolveClient(admin, parsed.request.clientId);
  } catch (error) {
    return { kind: "invalid", message: error instanceof OAuthError ? error.message : "Could not check the app asking for access." };
  }
  if (!client.redirectUris.includes(parsed.request.redirectUri)) {
    return { kind: "invalid", message: "That redirect URI was not registered by this app." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { kind: "sign_in" };
  if (!(await isConnectorUser(admin, user.id, user.email))) return { kind: "not_allowed", email: user.email };
  return { kind: "ready", request: parsed.request, client, user: { id: user.id, email: user.email }, origin };
}
