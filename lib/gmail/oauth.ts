import { randomUUID } from "node:crypto";
import { getGmailOAuthConfig } from "@/lib/env";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
];

type TokenExchangeResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export function buildGmailAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = getGmailOAuthConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export function generateOAuthState() {
  return randomUUID();
}

export async function exchangeCodeForGmailToken(code: string) {
  const { clientId, clientSecret, redirectUri } = getGmailOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as TokenExchangeResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        `Failed Gmail OAuth exchange (${response.status})`,
    );
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    tokenType: payload.token_type ?? "Bearer",
    scope: payload.scope ?? "",
    expiresAt:
      typeof payload.expires_in === "number"
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null,
    expiresIn: payload.expires_in ?? null,
  };
}

export async function refreshGmailAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGmailOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as TokenExchangeResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        `Failed Gmail token refresh (${response.status})`,
    );
  }
  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type ?? "Bearer",
    scope: payload.scope ?? "",
    expiresAt:
      typeof payload.expires_in === "number"
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : null,
    expiresIn: payload.expires_in ?? null,
  };
}
