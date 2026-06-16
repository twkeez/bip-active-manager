import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const appId = (process.env.META_APP_ID || "").trim();
const appSecret = (process.env.META_APP_SECRET || "").trim();
const fallbackToken = (process.env.META_GRAPH_ACCESS_TOKEN || "").trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!appId || !appSecret) {
  console.error("Missing META_APP_ID or META_APP_SECRET.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadStoredToken() {
  const { data, error } = await supabase
    .from("integration_api_tokens")
    .select("access_token")
    .eq("provider", "meta_graph")
    .eq("token_type", "user")
    .maybeSingle();
  if (error) throw new Error(`Failed to load stored token: ${error.message}`);
  return data?.access_token || null;
}

async function exchangeLongLived(token) {
  const url = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", token);

  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok || !json?.access_token) {
    throw new Error(
      json?.error?.message || `Meta token exchange failed (HTTP ${response.status}).`,
    );
  }
  return {
    accessToken: json.access_token,
    expiresIn: Number.isFinite(json.expires_in) ? json.expires_in : null,
  };
}

function computeExpiresAt(expiresIn) {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function saveToken({ accessToken, expiresIn }) {
  const expiresAt = computeExpiresAt(expiresIn);
  const { error } = await supabase.from("integration_api_tokens").upsert(
    {
      provider: "meta_graph",
      token_type: "user",
      access_token: accessToken,
      expires_at: expiresAt,
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { source: "script_refresh", expires_in: expiresIn },
    },
    { onConflict: "provider,token_type" },
  );
  if (error) throw new Error(`Failed to store refreshed token: ${error.message}`);
  return expiresAt;
}

async function main() {
  const storedToken = await loadStoredToken();
  const currentToken = storedToken || fallbackToken;
  if (!currentToken) {
    throw new Error("No existing token found. Set META_GRAPH_ACCESS_TOKEN first.");
  }
  const refreshed = await exchangeLongLived(currentToken);
  const expiresAt = await saveToken(refreshed);
  console.log("Meta token refreshed and stored.");
  console.log(`Expires at: ${expiresAt || "unknown"}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
