import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshGoogleAccessToken } from "@/lib/google/oauth";

const PROVIDER = "google_analytics";
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

type TokenRow = {
  provider: string;
  token_type: string;
  access_token: string;
  expires_at: string | null;
  last_refreshed_at: string;
  metadata: Record<string, unknown> | null;
};

function tokenTypeForUser(userId: string) {
  return `user:${userId}`;
}

function isExpiredOrNearExpiry(expiresAt: string | null) {
  if (!expiresAt) return true;
  const ms = new Date(expiresAt).getTime();
  if (Number.isNaN(ms)) return true;
  return ms - Date.now() <= REFRESH_BUFFER_MS;
}

async function loadStoredToken(admin: SupabaseClient, userId: string) {
  const result = await admin
    .from("integration_api_tokens")
    .select("provider,token_type,access_token,expires_at,last_refreshed_at,metadata")
    .eq("provider", PROVIDER)
    .eq("token_type", tokenTypeForUser(userId))
    .maybeSingle<TokenRow>();
  if (result.error) throw new Error(`Failed to load Google token: ${result.error.message}`);
  return result.data;
}

export async function saveGoogleToken(
  admin: SupabaseClient,
  params: {
    userId: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
    scope: string;
    source: "oauth_exchange" | "refresh";
  },
) {
  const now = new Date().toISOString();
  const metadata: Record<string, unknown> = { scope: params.scope, source: params.source };
  if (params.refreshToken) metadata.refresh_token = params.refreshToken;
  const { error } = await admin.from("integration_api_tokens").upsert(
    {
      provider: PROVIDER,
      token_type: tokenTypeForUser(params.userId),
      access_token: params.accessToken,
      expires_at: params.expiresAt,
      last_refreshed_at: now,
      updated_at: now,
      metadata,
    },
    { onConflict: "provider,token_type" },
  );
  if (error) throw new Error(`Failed to store Google token: ${error.message}`);
}

export async function getGoogleAccessTokenForUser(admin: SupabaseClient, userId: string): Promise<string | null> {
  const stored = await loadStoredToken(admin, userId);
  if (!stored?.access_token) return null;

  if (!isExpiredOrNearExpiry(stored.expires_at)) {
    return stored.access_token;
  }

  const refreshToken = String(stored.metadata?.refresh_token ?? "").trim();
  if (!refreshToken) return stored.access_token;

  try {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    await saveGoogleToken(admin, {
      userId,
      accessToken: refreshed.accessToken,
      refreshToken,
      expiresAt: refreshed.expiresAt,
      scope: refreshed.scope,
      source: "refresh",
    });
    return refreshed.accessToken;
  } catch {
    return stored.access_token;
  }
}

/**
 * Any stored Google connection that carries a given scope, refreshed if stale.
 *
 * Background jobs — the ads sync, the nightly pulls — have no signed-in user to
 * look a token up by, and not every connection has every permission. This finds
 * one that does, so connecting Google once in the app is enough for those jobs
 * to keep working.
 */
export async function getGoogleAccessTokenForScope(
  admin: SupabaseClient,
  scopeFragment: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("integration_api_tokens")
    .select("provider,token_type,access_token,expires_at,last_refreshed_at,metadata")
    .eq("provider", PROVIDER)
    .returns<TokenRow[]>();
  if (error) throw new Error(`Failed to load Google tokens: ${error.message}`);

  const match = (data ?? []).find(
    (row) =>
      Boolean(row.access_token) &&
      String(row.metadata?.scope ?? "").includes(scopeFragment),
  );
  if (!match) return null;
  if (!isExpiredOrNearExpiry(match.expires_at)) return match.access_token;

  const refreshToken = String(match.metadata?.refresh_token ?? "").trim();
  if (!refreshToken) return match.access_token;

  try {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    const now = new Date().toISOString();
    await admin
      .from("integration_api_tokens")
      .update({
        access_token: refreshed.accessToken,
        expires_at: refreshed.expiresAt,
        last_refreshed_at: now,
        updated_at: now,
        metadata: { ...match.metadata, scope: refreshed.scope, source: "refresh" },
      })
      .eq("provider", PROVIDER)
      .eq("token_type", match.token_type);
    return refreshed.accessToken;
  } catch {
    // An expired token still beats no token: the caller reports the real error.
    return match.access_token;
  }
}

export async function deleteGoogleTokenForUser(admin: SupabaseClient, userId: string) {
  const { error } = await admin
    .from("integration_api_tokens")
    .delete()
    .eq("provider", PROVIDER)
    .eq("token_type", tokenTypeForUser(userId));
  if (error) throw new Error(`Failed to disconnect Google: ${error.message}`);
}

export async function isGoogleConnectedForUser(admin: SupabaseClient, userId: string): Promise<boolean> {
  const stored = await loadStoredToken(admin, userId);
  return Boolean(stored?.access_token);
}
