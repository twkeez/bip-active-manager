import type { SupabaseClient } from "@supabase/supabase-js";
import { JWT, OAuth2Client } from "google-auth-library";
import { getGoogleOAuthRefreshConfig, getGoogleServiceAccountConfig } from "@/lib/env";
import { refreshGoogleAccessToken } from "@/lib/google/oauth";
import { refreshGmailAccessToken } from "@/lib/gmail/oauth";
import { getMetaAccessTokenForSync } from "@/lib/social/token-manager";

export type CredentialCheck = {
  /** Stable per login, e.g. "cred:meta". */
  key: string;
  label: string;
  ok: boolean;
  /** Why it is not ok, in plain words, with what to do. */
  problem?: string;
};

const DAY = 86_400_000;
/** Warn this far ahead of a login that will expire. */
export const EXPIRY_WARNING_DAYS = 7;

type StoredToken = { provider: string; token_type: string; metadata: Record<string, unknown> | null };

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Try every login the scheduled jobs depend on, for real.
 *
 * The token helpers fall back quietly: an expired Google token is handed on
 * "because it beats no token", and the job then fails as "blocked" with a
 * permission error that reads like an access problem. Checking the logins
 * directly says which one broke and that it needs reconnecting.
 */
export async function checkCredentials(admin: SupabaseClient, now: Date = new Date()): Promise<CredentialCheck[]> {
  const checks: Promise<CredentialCheck>[] = [];

  // Meta: Facebook/Instagram posts and page metrics.
  checks.push(
    (async (): Promise<CredentialCheck> => {
      const key = "cred:meta";
      const label = "Meta (Facebook/Instagram) login";
      try {
        const { accessToken, expiresAt } = await getMetaAccessTokenForSync(admin);
        const response = await fetch(
          `https://graph.facebook.com/v20.0/me?fields=id&access_token=${encodeURIComponent(accessToken)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          const json = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          return {
            key,
            label,
            ok: false,
            problem: `Meta refused the login: ${json?.error?.message ?? `HTTP ${response.status}`}. Social syncs will fail until a fresh token is set (META_GRAPH_ACCESS_TOKEN).`,
          };
        }
        if (expiresAt) {
          const daysLeft = (new Date(expiresAt).getTime() - now.getTime()) / DAY;
          if (daysLeft < EXPIRY_WARNING_DAYS) {
            return {
              key,
              label,
              ok: false,
              problem: `The Meta login expires in ${Math.max(0, Math.floor(daysLeft))} days and could not be renewed. Set a fresh token (META_GRAPH_ACCESS_TOKEN) before then.`,
            };
          }
        }
        return { key, label, ok: true };
      } catch (error) {
        return { key, label, ok: false, problem: `The Meta login does not work: ${reason(error)}` };
      }
    })(),
  );

  // Google connections stored in the app (Analytics, Ads, Business Profile)
  // and Gmail connections (inbox sync, alert emails, Business Profile).
  const { data: stored, error } = await admin
    .from("integration_api_tokens")
    .select("provider,token_type,metadata")
    .in("provider", ["google_analytics", "gmail"])
    .returns<StoredToken[]>();
  if (error) throw new Error(`Could not read stored logins: ${error.message}`);
  for (const row of stored ?? []) {
    const isGmail = row.provider === "gmail";
    const key = `cred:${row.provider}:${row.token_type}`;
    const label = isGmail ? "Gmail connection" : "Google connection";
    const refreshToken = String(row.metadata?.refresh_token ?? "").trim();
    checks.push(
      (async (): Promise<CredentialCheck> => {
        if (!refreshToken) {
          return {
            key,
            label,
            ok: false,
            problem: `The ${label} cannot renew itself (no refresh token stored), so it stops working within the hour. Reconnect it in the app.`,
          };
        }
        try {
          await (isGmail ? refreshGmailAccessToken(refreshToken) : refreshGoogleAccessToken(refreshToken));
          return { key, label, ok: true };
        } catch (refreshError) {
          return {
            key,
            label,
            ok: false,
            problem: `The ${label} has expired or was revoked (${reason(refreshError)}). Jobs that use it are failing. Reconnect Google${isGmail ? " (Gmail)" : ""} in the app.`,
          };
        }
      })(),
    );
  }

  // The Google login set in Vercel (GOOGLE_OAUTH_REFRESH_TOKEN): Search Console, fallbacks.
  const envGoogle = getGoogleOAuthRefreshConfig();
  if (envGoogle) {
    checks.push(
      (async (): Promise<CredentialCheck> => {
        const key = "cred:google-env";
        const label = "Google login in Vercel settings";
        try {
          const oauth = new OAuth2Client(envGoogle.clientId, envGoogle.clientSecret, envGoogle.redirectUri);
          oauth.setCredentials({ refresh_token: envGoogle.refreshToken });
          const token = await oauth.getAccessToken();
          if (!token?.token) throw new Error("no token returned");
          return { key, label, ok: true };
        } catch (envError) {
          return {
            key,
            label,
            ok: false,
            problem: `The Google login in Vercel (GOOGLE_OAUTH_REFRESH_TOKEN) no longer works (${reason(envError)}). Search Console syncs will fail until it is replaced.`,
          };
        }
      })(),
    );
  }

  // The Google service account, when one is configured.
  let serviceAccount: ReturnType<typeof getGoogleServiceAccountConfig> | null = null;
  try {
    serviceAccount = getGoogleServiceAccountConfig();
  } catch {
    serviceAccount = null;
  }
  if (serviceAccount) {
    const account = serviceAccount;
    checks.push(
      (async (): Promise<CredentialCheck> => {
        const key = "cred:google-service-account";
        const label = "Google service account";
        try {
          const auth = new JWT({
            email: account.clientEmail,
            key: account.privateKey,
            scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
          });
          const token = await auth.getAccessToken();
          if (!token?.token) throw new Error("no token returned");
          return { key, label, ok: true };
        } catch (saError) {
          return {
            key,
            label,
            ok: false,
            problem: `The Google service account cannot sign in (${reason(saError)}). Its key may have been deleted or disabled.`,
          };
        }
      })(),
    );
  }

  return Promise.all(checks);
}
