import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshGmailAccessToken } from "@/lib/gmail/oauth";

const PROVIDER = "gmail";
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
  if (result.error) {
    throw new Error(`Failed to load Gmail token: ${result.error.message}`);
  }
  return result.data;
}

export async function saveGmailToken(
  admin: SupabaseClient,
  params: {
    userId: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
    scope: string;
    tokenType?: string;
    source: "oauth_exchange" | "refresh";
  },
) {
  const now = new Date().toISOString();
  const metadata: Record<string, unknown> = {
    scope: params.scope,
    source: params.source,
  };
  if (params.refreshToken) metadata.refresh_token = params.refreshToken;
  if (params.tokenType) metadata.token_type = params.tokenType;
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
  if (error) {
    throw new Error(`Failed to store Gmail token: ${error.message}`);
  }
}

export async function getGmailAccessTokenForUser(
  admin: SupabaseClient,
  userId: string,
) {
  const stored = await loadStoredToken(admin, userId);
  if (!stored?.access_token) {
    throw new Error("Gmail is not connected for this user.");
  }
  if (!isExpiredOrNearExpiry(stored.expires_at)) {
    return { accessToken: stored.access_token, expiresAt: stored.expires_at };
  }
  const refreshTokenRaw = String(stored.metadata?.refresh_token ?? "").trim();
  if (!refreshTokenRaw) {
    return { accessToken: stored.access_token, expiresAt: stored.expires_at };
  }
  const refreshed = await refreshGmailAccessToken(refreshTokenRaw);
  await saveGmailToken(admin, {
    userId,
    accessToken: refreshed.accessToken,
    refreshToken: refreshTokenRaw,
    expiresAt: refreshed.expiresAt,
    scope: refreshed.scope,
    tokenType: refreshed.tokenType,
    source: "refresh",
  });
  return { accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt };
}

export async function deleteGmailTokenForUser(admin: SupabaseClient, userId: string) {
  const { error } = await admin
    .from("integration_api_tokens")
    .delete()
    .eq("provider", PROVIDER)
    .eq("token_type", tokenTypeForUser(userId));
  if (error) {
    throw new Error(`Failed to disconnect Gmail: ${error.message}`);
  }
}
