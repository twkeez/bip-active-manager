import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Rules for the Claude connector's sign-in (OAuth 2.1). Pure functions, so
// every rule is tested; lib/mcp-oauth/server.ts does the storage.

export const SCOPE = "poobah";
export const ACCESS_TOKEN_SECONDS = 60 * 60;
export const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
export const CODE_SECONDS = 10 * 60;

/** The public origin a request reached, as Vercel forwards it. */
export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || url.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "") ||
    "https";
  return `${proto}://${host}`;
}

export const resourceFor = (origin: string) => `${origin}/api/mcp`;

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
    client_id_metadata_document_supported: true,
  };
}

/**
 * Where a sign-in may send its code: Claude's own callback, or this computer
 * (for the MCP Inspector and other local tools, per RFC 8252). Anything else
 * is refused, so a code can never be handed to a stranger's site.
 */
export function isAllowedRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === "https:" && ["claude.ai", "claude.com"].includes(url.hostname)) {
    return url.pathname === "/api/mcp/auth_callback";
  }
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return true;
  return false;
}

/**
 * Hosts whose client metadata documents (CIMD) are fetched. Fetching any URL
 * a caller names would let them make this server call anywhere.
 */
export function isAllowedMetadataUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (["claude.ai", "claude.com"].includes(url.hostname) || url.hostname.endsWith(".anthropic.com"))
    );
  } catch {
    return false;
  }
}

/** A random secret: codes, tokens, client ids. */
export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** How a code or token is stored: never the value itself. */
export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** PKCE S256: the verifier the client sends now must hash to the challenge it sent before. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

/** A same-site path to return to after signing in; anything else goes to the dashboard. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/dashboard";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/dashboard";
  return value;
}

export type AuthorizeRequest = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  resource: string;
  scope: string;
};

/**
 * Check an authorization request's parameters. Returns the request, or the
 * reason it cannot proceed. Whether the client and its redirect URI belong
 * together is checked separately, against the registration.
 */
export function parseAuthorizeParams(
  params: Record<string, string | undefined>,
  origin: string,
): { ok: true; request: AuthorizeRequest } | { ok: false; error: string } {
  const clientId = params.client_id?.trim();
  const redirectUri = params.redirect_uri?.trim();
  if (!clientId) return { ok: false, error: "client_id is missing." };
  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) return { ok: false, error: "redirect_uri is missing or not allowed." };
  if (params.response_type !== "code") return { ok: false, error: "response_type must be code." };
  if (!params.code_challenge || !/^[A-Za-z0-9\-_]{43}$/.test(params.code_challenge)) {
    return { ok: false, error: "A PKCE code_challenge is required." };
  }
  if (params.code_challenge_method !== "S256") return { ok: false, error: "code_challenge_method must be S256." };
  const resource = params.resource?.trim() || resourceFor(origin);
  if (resource.replace(/\/$/, "") !== resourceFor(origin)) return { ok: false, error: `resource must be ${resourceFor(origin)}.` };
  const requested = (params.scope ?? "").split(/\s+/).filter(Boolean);
  if (requested.some((scope) => scope !== SCOPE)) return { ok: false, error: `The only scope offered is "${SCOPE}".` };
  return {
    ok: true,
    request: { clientId, redirectUri, state: params.state ?? null, codeChallenge: params.code_challenge, resource: resourceFor(origin), scope: SCOPE },
  };
}

/** The redirect back to the client with a code, or with an error (RFC 6749 §4.1.2). */
export function redirectWith(redirectUri: string, values: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) if (value != null) url.searchParams.set(key, value);
  return url.toString();
}
