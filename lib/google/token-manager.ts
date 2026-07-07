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
