// OAuth token exchange for the Illuminare Basecamp app. Mirrors lib/basecamp/auth.ts
// (same request shape as the working vet-side flow) but uses the Illuminare config.
// Account lookup is config-independent, so we reuse getBasecampAccountId directly.
import { getIlluminareBasecampOAuthConfig } from "@/lib/env";

const AUTH_URL = "https://launchpad.37signals.com/authorization/new";
const TOKEN_URL = "https://launchpad.37signals.com/authorization/token";

type TokenExchangeResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  created_at?: number;
  scope?: string;
};

export function buildIlluminareBasecampAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = getIlluminareBasecampOAuthConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function postTokenRequest(params: URLSearchParams) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Basecamp token request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as TokenExchangeResponse;
}

function computeExpiresAt(payload: TokenExchangeResponse) {
  const fallbackSeconds = 14 * 24 * 60 * 60;
  const seconds = payload.expires_in ?? fallbackSeconds;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function exchangeIlluminareCodeForToken(code: string) {
  const { clientId, clientSecret, redirectUri } = getIlluminareBasecampOAuthConfig();
  const payload = await postTokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  );

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type ?? "Bearer",
    scope: payload.scope ?? null,
    expiresAt: computeExpiresAt(payload),
  };
}

export async function refreshIlluminareBasecampToken(refreshToken: string) {
  const { clientId, clientSecret } = getIlluminareBasecampOAuthConfig();
  const payload = await postTokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  );

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type ?? "Bearer",
    scope: payload.scope ?? null,
    expiresAt: computeExpiresAt(payload),
  };
}
