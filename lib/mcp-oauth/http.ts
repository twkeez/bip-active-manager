import { NextResponse } from "next/server";
import { authorizationServerMetadata, publicOrigin, resourceFor, SCOPE } from "./core";
import { OAuthError } from "./server";

// The connector's public endpoints are called by Claude's servers and by
// browser-based tools such as the MCP Inspector, so they answer CORS. None of
// them reads cookies, so allowing any origin exposes nothing.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...extra } });
}

export function oauthErrorResponse(error: unknown): NextResponse {
  if (error instanceof OAuthError) return json({ error: error.code, error_description: error.message }, error.status);
  return json({ error: "server_error", error_description: error instanceof Error ? error.message : "Something went wrong." }, 500);
}

export function authorizationServerMetadataResponse(request: Request): NextResponse {
  return json(authorizationServerMetadata(publicOrigin(request)));
}

/** RFC 9728: which authorization server protects /api/mcp. */
export function protectedResourceMetadataResponse(request: Request): NextResponse {
  const origin = publicOrigin(request);
  return json({
    resource: resourceFor(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "BIP Control: Poobah Client Watch",
  });
}
