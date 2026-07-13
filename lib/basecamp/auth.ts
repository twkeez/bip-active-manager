import { getBasecampOAuthConfig } from "@/lib/env";

const AUTH_URL = "https://launchpad.37signals.com/authorization/new";
const TOKEN_URL = "https://launchpad.37signals.com/authorization/token";
const AUTH_INFO_URL = "https://launchpad.37signals.com/authorization.json";

type TokenExchangeResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  created_at?: number;
  scope?: string;
};

type AuthorizationResponse = {
  accounts?: Array<{
    product?: string;
    href?: string;
  }>;
};

function parseAccountIdFromHref(href: string) {
  // Account hrefs look like "https://3.basecampapi.com/6140995" (no trailing
  // slash), so match the id right after the host rather than between slashes.
  const match = href.match(/basecampapi\.com\/(\d+)/);
  return match?.[1] ?? null;
}

export function buildBasecampAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = getBasecampOAuthConfig();
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

export async function exchangeCodeForToken(code: string) {
  const { clientId, clientSecret, redirectUri } = getBasecampOAuthConfig();
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

export async function refreshBasecampToken(refreshToken: string) {
  const { clientId, clientSecret } = getBasecampOAuthConfig();
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

export async function getBasecampAccountId(accessToken: string) {
  const response = await fetch(AUTH_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "BIPClientManager (ops@beyondindigo.com)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Basecamp authorization lookup failed (${response.status}): ${body}`,
    );
  }

  const payload = (await response.json()) as AuthorizationResponse;
  const account = payload.accounts?.find((item) => item.product === "bc3");
  if (!account?.href) {
    throw new Error("No Basecamp 4 account found in authorization response");
  }
  const accountId = parseAccountIdFromHref(account.href);
  if (!accountId) {
    throw new Error(`Could not parse account id from href: ${account.href}`);
  }
  return accountId;
}
