import { getMetaGraphConfig } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";

const PROVIDER = "meta_graph";
const TOKEN_TYPE = "user";
const REFRESH_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

type TokenRow = {
  provider: string;
  token_type: string;
  access_token: string;
  expires_at: string | null;
  last_refreshed_at: string;
  metadata: Record<string, unknown> | null;
};

function hasRefreshCredentials() {
  return Boolean(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim());
}

function computeExpiresAt(expiresInSeconds: number | null | undefined) {
  if (!expiresInSeconds || !Number.isFinite(expiresInSeconds)) return null;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

function shouldRefresh(expiresAt: string | null) {
  if (!expiresAt) return true;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return true;
  return expiresAtMs - Date.now() <= REFRESH_BEFORE_MS;
}

async function exchangeForLongLivedMetaToken(currentToken: string) {
  const { appId, appSecret } = getMetaGraphConfig();
  if (!appId || !appSecret) {
    throw new Error(
      "Missing META_APP_ID or META_APP_SECRET. Add both to enable automatic token refresh.",
    );
  }
  const url = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", currentToken);
  const response = await fetch(url.toString(), { cache: "no-store" });
  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!response.ok || !json.access_token) {
    throw new Error(
      json.error?.message ??
        `Failed to refresh Meta access token (HTTP ${response.status}).`,
    );
  }
  return {
    accessToken: json.access_token,
    expiresAt: computeExpiresAt(json.expires_in ?? null),
    expiresIn: json.expires_in ?? null,
  };
}

async function loadStoredMetaToken(admin: SupabaseClient) {
  const result = await admin
    .from("integration_api_tokens")
    .select("provider,token_type,access_token,expires_at,last_refreshed_at,metadata")
    .eq("provider", PROVIDER)
    .eq("token_type", TOKEN_TYPE)
    .maybeSingle<TokenRow>();
  if (result.error) {
    throw new Error(`Failed to load stored integration token: ${result.error.message}`);
  }
  return result.data;
}

async function saveStoredMetaToken(
  admin: SupabaseClient,
  token: { accessToken: string; expiresAt: string | null; expiresIn: number | null },
  source: "env_seed" | "auto_refresh" | "manual_refresh",
) {
  const { error } = await admin.from("integration_api_tokens").upsert(
    {
      provider: PROVIDER,
      token_type: TOKEN_TYPE,
      access_token: token.accessToken,
      expires_at: token.expiresAt,
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        source,
        expires_in: token.expiresIn,
      },
    },
    { onConflict: "provider,token_type" },
  );
  if (error) {
    throw new Error(`Failed to store integration token: ${error.message}`);
  }
}

export async function getMetaAccessTokenForSync(
  admin: SupabaseClient,
) {
  const config = getMetaGraphConfig();
  const envToken = config.accessToken;
  const stored = await loadStoredMetaToken(admin);
  if (stored && stored.access_token && !shouldRefresh(stored.expires_at)) {
    return { accessToken: stored.access_token, expiresAt: stored.expires_at };
  }

  const baseToken = stored?.access_token ?? envToken;
  if (!hasRefreshCredentials()) {
    if (!stored || stored.access_token !== envToken) {
      await saveStoredMetaToken(
        admin,
        { accessToken: envToken, expiresAt: null, expiresIn: null },
        "env_seed",
      );
    }
    return { accessToken: envToken, expiresAt: stored?.expires_at ?? null };
  }

  try {
    const refreshed = await exchangeForLongLivedMetaToken(baseToken);
    await saveStoredMetaToken(admin, refreshed, stored ? "auto_refresh" : "env_seed");
    return { accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta token refresh failed.";
    if (envToken && envToken !== baseToken) {
      try {
        const refreshedFromEnv = await exchangeForLongLivedMetaToken(envToken);
        await saveStoredMetaToken(admin, refreshedFromEnv, "env_seed");
        return {
          accessToken: refreshedFromEnv.accessToken,
          expiresAt: refreshedFromEnv.expiresAt,
        };
      } catch {
        // fall through to final error below
      }
    }
    if (stored?.access_token && stored.expires_at && new Date(stored.expires_at) > new Date()) {
      return { accessToken: stored.access_token, expiresAt: stored.expires_at };
    }
    throw new Error(
      `Meta token refresh failed: ${message}. Generate a fresh user token, set META_GRAPH_ACCESS_TOKEN, then retry sync.`,
    );
  }
}

export async function refreshMetaAccessTokenNow(
  admin: SupabaseClient,
) {
  const config = getMetaGraphConfig();
  const envToken = config.accessToken;
  const stored = await loadStoredMetaToken(admin);
  const candidates = [stored?.access_token, envToken].filter(
    (token, index, arr): token is string =>
      Boolean(token) && arr.indexOf(token) === index,
  );
  let lastError: Error | null = null;
  for (const token of candidates) {
    try {
      const refreshed = await exchangeForLongLivedMetaToken(token);
      await saveStoredMetaToken(admin, refreshed, "manual_refresh");
      return refreshed;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Meta token refresh failed.");
    }
  }
  throw (
    lastError ??
    new Error(
      "Meta token refresh failed. Generate a fresh user token and set META_GRAPH_ACCESS_TOKEN.",
    )
  );
}
