import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { publicOrigin, resourceFor, SCOPE } from "@/lib/mcp-oauth/core";
import { CORS_HEADERS, preflight } from "@/lib/mcp-oauth/http";
import { verifyAccessToken } from "@/lib/mcp-oauth/server";
import { registerPoobahTools } from "@/lib/poobah/mcp-tools";
import { POOBAH_NAME } from "@/lib/poobah/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The Claude connector (MCP) for Poobah Client Watch. Every request needs a
 * key from this app's own sign-in (lib/mcp-oauth): a Beyond Indigo admin,
 * checked again on every call. Without one it answers 401 and points Claude at
 * /.well-known/oauth-protected-resource to sign in.
 */

export const maxDuration = 60;

const mcp = createMcpHandler((server) => registerPoobahTools(server), {
  serverInfo: { name: "bip-poobah-client-watch", version: "1.0.0" },
  instructions: `${POOBAH_NAME}: Tom's notebook of closely watched clients at Beyond Indigo. Each watched client has a current status, open items, a dated running log and account basics. Use list_watched_clients first to find ids. Nothing can be deleted; every change is recorded as made by Claude for the signed-in person.`,
});

const handler = withMcpAuth(
  mcp,
  async (request, token) => {
    if (!token) return undefined;
    const resource = resourceFor(publicOrigin(request));
    const access = await verifyAccessToken(createAdminClient(), token, resource);
    if (!access) return undefined;
    return {
      token,
      clientId: access.clientId,
      scopes: [access.scope],
      expiresAt: access.expiresAt,
      resource: new URL(access.resource),
      extra: { email: access.email, userId: access.userId },
    };
  },
  { required: true, requiredScopes: [SCOPE], resourceMetadataPath: "/.well-known/oauth-protected-resource" },
);

async function withCors(request: Request): Promise<Response> {
  const response = await handler(request);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export { withCors as GET, withCors as POST, withCors as DELETE };
export const OPTIONS = preflight;
