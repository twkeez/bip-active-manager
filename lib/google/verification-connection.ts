import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshGoogleAccessToken } from "@/lib/google/oauth";

// A second, admin-only Google connection for getting Search Console access in
// bulk: read Tag Manager, give yourself Publish on a container, verify site
// ownership through Tag Manager, and add the site to Search Console. Kept apart
// from the everyday "Connect Google" so nobody else's consent screen asks for
// these. It goes through the same Google callback; a cookie says which flow it
// is. Stored in integration_api_tokens under its own provider.

const PROVIDER = "google_site_verification";
export const VERIFICATION_FLOW_COOKIE = "google_oauth_flow";
export const VERIFICATION_FLOW = "site-verification";

export const VERIFICATION_SCOPES = [
  // Which Google account was connected, shown on the page.
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/tagmanager.readonly",
  // Reading and changing who can do what in a Tag Manager account (only works where you're an account admin).
  "https://www.googleapis.com/auth/tagmanager.manage.users",
  "https://www.googleapis.com/auth/siteverification",
  // Full Search Console scope: adding a verified site to your Search Console.
  "https://www.googleapis.com/auth/webmasters",
];

export function buildVerificationAuthorizationUrl(state: string, appOrigin: string): string {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  if (!clientId) throw new Error("Missing GOOGLE_CLIENT_ID");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${appOrigin.replace(/\/$/, "")}/api/google/oauth/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", VERIFICATION_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

type Row = { access_token: string; expires_at: string | null; updated_at: string; metadata: Record<string, unknown> | null };

const tokenType = (userId: string) => `user:${userId}`;

export async function saveVerificationToken(
  admin: SupabaseClient,
  params: { userId: string; accessToken: string; refreshToken: string | null; expiresAt: string | null; scope: string; email?: string | null },
) {
  const now = new Date().toISOString();
  const existing = await loadRow(admin, params.userId);
  const metadata: Record<string, unknown> = {
    ...(existing?.metadata ?? {}),
    scope: params.scope,
    ...(params.refreshToken ? { refresh_token: params.refreshToken } : {}),
    ...(params.email ? { email: params.email } : {}),
  };
  const { error } = await admin.from("integration_api_tokens").upsert(
    {
      provider: PROVIDER,
      token_type: tokenType(params.userId),
      access_token: params.accessToken,
      expires_at: params.expiresAt,
      last_refreshed_at: now,
      updated_at: now,
      metadata,
    },
    { onConflict: "provider,token_type" },
  );
  if (error) throw new Error(`Couldn't save the site-verification connection: ${error.message}`);
}

async function loadRow(admin: SupabaseClient, userId: string): Promise<Row | null> {
  const { data, error } = await admin
    .from("integration_api_tokens")
    .select("access_token,expires_at,updated_at,metadata")
    .eq("provider", PROVIDER)
    .eq("token_type", tokenType(userId))
    .maybeSingle<Row>();
  if (error) throw new Error(`Couldn't read the site-verification connection: ${error.message}`);
  return data;
}

/** What the page shows: who is connected, since when, and which of the needed permissions Google granted. */
export async function verificationConnectionStatus(admin: SupabaseClient, userId: string) {
  const row = await loadRow(admin, userId);
  if (!row) return null;
  const granted = String(row.metadata?.scope ?? "").split(/\s+/);
  return {
    email: (row.metadata?.email as string | undefined) ?? null,
    connectedAt: row.updated_at,
    missingScopes: VERIFICATION_SCOPES.filter((s) => !granted.includes(s)),
  };
}

/** A working access token for this admin's site-verification connection, refreshed when stale. */
export async function getVerificationAccessToken(admin: SupabaseClient, userId: string): Promise<string> {
  const row = await loadRow(admin, userId);
  if (!row) throw new Error("No site-verification connection: connect Google on the Search Console access page first.");
  const fresh = row.expires_at && new Date(row.expires_at).getTime() - Date.now() > 2 * 60 * 1000;
  if (fresh) return row.access_token;
  const refreshToken = String(row.metadata?.refresh_token ?? "").trim();
  if (!refreshToken) throw new Error("The site-verification connection has expired: connect Google again.");
  const refreshed = await refreshGoogleAccessToken(refreshToken);
  await saveVerificationToken(admin, { userId, accessToken: refreshed.accessToken, refreshToken, expiresAt: refreshed.expiresAt, scope: refreshed.scope });
  return refreshed.accessToken;
}
