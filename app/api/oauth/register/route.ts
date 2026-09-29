import { json, oauthErrorResponse, preflight } from "@/lib/mcp-oauth/http";
import { registerClient } from "@/lib/mcp-oauth/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Dynamic client registration (RFC 7591) for the Claude connector. Anyone may
 * register, but registering grants nothing: every sign-in still needs a
 * Beyond Indigo admin to sign in with Google and press Allow, and codes only
 * go to Claude's callback or localhost.
 */
export async function POST(request: Request) {
  try {
    const client = await registerClient(createAdminClient(), await request.json().catch(() => null));
    return json(
      {
        client_id: client.clientId,
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        client_id_issued_at: Math.floor(Date.now() / 1000),
      },
      201,
    );
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export const OPTIONS = preflight;
