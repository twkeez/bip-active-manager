import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAllowedEmail } from "@/lib/auth/allowed-domain";
import {
  ACCESS_TOKEN_SECONDS,
  CODE_SECONDS,
  REFRESH_TOKEN_SECONDS,
  hashSecret,
  isAllowedMetadataUrl,
  isAllowedRedirectUri,
  pkceMatches,
  randomSecret,
  type AuthorizeRequest,
} from "./core";

// Storage for the Claude connector's sign-in. Every failure is an explicit
// OAuthError with the standard error code, never a quiet fallback.

export class OAuthError extends Error {
  constructor(
    readonly code: "invalid_request" | "invalid_client" | "invalid_grant" | "unauthorized_client" | "unsupported_grant_type" | "invalid_client_metadata" | "invalid_redirect_uri" | "server_error",
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

/** How long a just-used refresh token may be presented again (a concurrent renewal, not theft). */
export const REFRESH_REUSE_GRACE_MS = 2 * 60 * 1000;

export type OAuthClient = { clientId: string; clientName: string; redirectUris: string[] };

function failed(context: string, error: { message: string } | null): never {
  throw new OAuthError("server_error", `${context}: ${error?.message ?? "unknown error"}`, 500);
}

/** Dynamic client registration (RFC 7591): a public client with PKCE, no secret. */
export async function registerClient(admin: SupabaseClient, body: unknown): Promise<OAuthClient> {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const redirectUris = Array.isArray(input.redirect_uris) ? input.redirect_uris.filter((uri): uri is string => typeof uri === "string") : [];
  if (!redirectUris.length) throw new OAuthError("invalid_redirect_uri", "redirect_uris is required.");
  const refused = redirectUris.filter((uri) => !isAllowedRedirectUri(uri));
  if (refused.length) {
    throw new OAuthError("invalid_redirect_uri", `Not an allowed redirect URI: ${refused.join(", ")}. Only Claude's callback and this computer (localhost) are accepted.`);
  }
  const method = input.token_endpoint_auth_method ?? "none";
  if (method !== "none") throw new OAuthError("invalid_client_metadata", "Only public clients (token_endpoint_auth_method \"none\") with PKCE are supported.");
  const clientName = typeof input.client_name === "string" && input.client_name.trim() ? input.client_name.trim().slice(0, 100) : "Unnamed app";
  const client: OAuthClient = { clientId: `bip-${randomSecret(18)}`, clientName, redirectUris };
  const { error } = await admin.from("mcp_oauth_clients").insert({
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
  });
  if (error) failed("Could not register the client", error);
  return client;
}

/**
 * The client named by `clientId`: one that registered here, or (CIMD) an
 * https URL on an allowed host serving the client's own metadata.
 */
export async function resolveClient(admin: SupabaseClient, clientId: string): Promise<OAuthClient> {
  if (/^https:\/\//.test(clientId)) {
    if (!isAllowedMetadataUrl(clientId)) throw new OAuthError("invalid_client", "This client's metadata URL is not on an allowed host.");
    let doc: Record<string, unknown>;
    try {
      const response = await fetch(clientId, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000), redirect: "error" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      doc = (await response.json()) as Record<string, unknown>;
    } catch (error) {
      throw new OAuthError("invalid_client", `Could not read the client's metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (doc.client_id !== clientId) throw new OAuthError("invalid_client", "The client's metadata does not name itself.");
    const redirectUris = Array.isArray(doc.redirect_uris) ? doc.redirect_uris.filter((uri): uri is string => typeof uri === "string" && isAllowedRedirectUri(uri)) : [];
    if (!redirectUris.length) throw new OAuthError("invalid_client", "The client's metadata lists no allowed redirect URI.");
    return { clientId, clientName: typeof doc.client_name === "string" ? doc.client_name.slice(0, 100) : new URL(clientId).hostname, redirectUris };
  }
  const { data, error } = await admin.from("mcp_oauth_clients").select("client_id,client_name,redirect_uris").eq("client_id", clientId).maybeSingle();
  if (error) failed("Could not read the client", error);
  if (!data) throw new OAuthError("invalid_client", "Unknown client. Remove and re-add the connector.", 401);
  return { clientId: data.client_id, clientName: data.client_name, redirectUris: data.redirect_uris };
}

/** Whether this person may use the connector: a Beyond Indigo admin, checked now. */
export async function isConnectorUser(admin: SupabaseClient, userId: string, email: string | null | undefined): Promise<boolean> {
  if (!isAllowedEmail(email)) return false;
  const { data, error } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) failed("Could not read the person's role", error);
  return data?.role === "admin";
}

export async function createAuthorizationCode(
  admin: SupabaseClient,
  request: AuthorizeRequest,
  user: { id: string; email: string },
): Promise<string> {
  const code = randomSecret();
  const { error } = await admin.from("mcp_oauth_codes").insert({
    code_hash: hashSecret(code),
    client_id: request.clientId,
    user_id: user.id,
    email: user.email,
    redirect_uri: request.redirectUri,
    code_challenge: request.codeChallenge,
    resource: request.resource,
    scope: request.scope,
    expires_at: new Date(Date.now() + CODE_SECONDS * 1000).toISOString(),
  });
  if (error) failed("Could not save the sign-in code", error);
  return code;
}

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

async function issueTokens(
  admin: SupabaseClient,
  grant: { familyId: string; clientId: string; userId: string; email: string; resource: string; scope: string },
): Promise<TokenResponse> {
  const access = randomSecret();
  const refresh = randomSecret();
  const now = Date.now();
  const base = { family_id: grant.familyId, client_id: grant.clientId, user_id: grant.userId, email: grant.email, resource: grant.resource, scope: grant.scope };
  const { error } = await admin.from("mcp_oauth_tokens").insert([
    { ...base, token_hash: hashSecret(access), kind: "access", expires_at: new Date(now + ACCESS_TOKEN_SECONDS * 1000).toISOString() },
    { ...base, token_hash: hashSecret(refresh), kind: "refresh", expires_at: new Date(now + REFRESH_TOKEN_SECONDS * 1000).toISOString() },
  ]);
  if (error) failed("Could not save the keys", error);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TOKEN_SECONDS, refresh_token: refresh, scope: grant.scope };
}

/** Exchange a code (once, within 10 minutes, with the matching PKCE verifier) for keys. */
export async function exchangeCode(
  admin: SupabaseClient,
  input: { code?: string; redirectUri?: string; clientId?: string; codeVerifier?: string; resource?: string },
): Promise<TokenResponse> {
  if (!input.code || !input.redirectUri || !input.clientId || !input.codeVerifier) {
    throw new OAuthError("invalid_request", "code, redirect_uri, client_id and code_verifier are all required.");
  }
  // Spend the code first, atomically: of two racing requests only one gets it.
  const { data, error } = await admin
    .from("mcp_oauth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", hashSecret(input.code))
    .is("used_at", null)
    .select("*")
    .maybeSingle();
  if (error) failed("Could not read the sign-in code", error);
  if (!data) throw new OAuthError("invalid_grant", "The sign-in code is unknown or was already used.");
  if (new Date(data.expires_at).getTime() < Date.now()) throw new OAuthError("invalid_grant", "The sign-in code expired. Sign in again.");
  if (data.client_id !== input.clientId || data.redirect_uri !== input.redirectUri) {
    throw new OAuthError("invalid_grant", "The sign-in code was issued to a different client or redirect URI.");
  }
  if (!pkceMatches(input.codeVerifier, data.code_challenge)) throw new OAuthError("invalid_grant", "The PKCE code_verifier does not match.");
  if (input.resource && input.resource.replace(/\/$/, "") !== data.resource) throw new OAuthError("invalid_grant", "The resource does not match the sign-in.");
  if (!(await isConnectorUser(admin, data.user_id, data.email))) {
    throw new OAuthError("invalid_grant", "This account may no longer use the connector (admins only).");
  }
  return issueTokens(admin, { familyId: randomUUID(), clientId: data.client_id, userId: data.user_id, email: data.email, resource: data.resource, scope: data.scope });
}

/** Swap a refresh token for new keys. A spent one coming back revokes the whole sign-in. */
export async function refreshTokens(
  admin: SupabaseClient,
  input: { refreshToken?: string; clientId?: string },
): Promise<TokenResponse> {
  if (!input.refreshToken || !input.clientId) throw new OAuthError("invalid_request", "refresh_token and client_id are required.");
  const hash = hashSecret(input.refreshToken);
  const { data: row, error } = await admin.from("mcp_oauth_tokens").select("*").eq("token_hash", hash).eq("kind", "refresh").maybeSingle();
  if (error) failed("Could not read the refresh token", error);
  if (!row) throw new OAuthError("invalid_grant", "Unknown refresh token. Sign in again.");
  if (row.client_id !== input.clientId) throw new OAuthError("invalid_grant", "The refresh token belongs to a different client.");
  if (row.revoked_at) throw new OAuthError("invalid_grant", "This sign-in was revoked. Sign in again.");
  if (new Date(row.expires_at).getTime() < Date.now()) throw new OAuthError("invalid_grant", "The sign-in expired. Sign in again.");
  if (row.used_at) {
    // Several Claude runs share one connection and can renew at the same
    // moment; the loser of that race is not a thief. Inside the grace window
    // it gets its own new keys. Outside it, a spent token coming back is
    // treated as stolen and the whole sign-in is revoked.
    if (Date.now() - new Date(row.used_at).getTime() > REFRESH_REUSE_GRACE_MS) {
      await admin.from("mcp_oauth_tokens").update({ revoked_at: new Date().toISOString() }).eq("family_id", row.family_id).is("revoked_at", null);
      throw new OAuthError("invalid_grant", "This refresh token was already used, so the sign-in was revoked for safety. Sign in again.");
    }
  } else {
    const { error: spendError } = await admin
      .from("mcp_oauth_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", hash)
      .is("used_at", null);
    if (spendError) failed("Could not spend the refresh token", spendError);
  }
  if (!(await isConnectorUser(admin, row.user_id, row.email))) {
    throw new OAuthError("invalid_grant", "This account may no longer use the connector (admins only).");
  }
  return issueTokens(admin, { familyId: row.family_id, clientId: row.client_id, userId: row.user_id, email: row.email, resource: row.resource, scope: row.scope });
}

export type VerifiedAccess = { clientId: string; userId: string; email: string; scope: string; resource: string; expiresAt: number };

/** The person behind an access token, if it is live, meant for this server, and they are still an admin. */
export async function verifyAccessToken(admin: SupabaseClient, token: string, resource: string): Promise<VerifiedAccess | null> {
  const { data: row, error } = await admin
    .from("mcp_oauth_tokens")
    .select("client_id,user_id,email,scope,resource,expires_at,revoked_at")
    .eq("token_hash", hashSecret(token))
    .eq("kind", "access")
    .maybeSingle();
  if (error) failed("Could not check the key", error);
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now() || row.resource !== resource) return null;
  if (!(await isConnectorUser(admin, row.user_id, row.email))) return null;
  return {
    clientId: row.client_id,
    userId: row.user_id,
    email: row.email,
    scope: row.scope,
    resource: row.resource,
    expiresAt: Math.floor(new Date(row.expires_at).getTime() / 1000),
  };
}
