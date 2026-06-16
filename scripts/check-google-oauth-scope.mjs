function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

async function exchangeRefreshTokenForAccessToken() {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
  const refreshToken = requiredEnv("GOOGLE_OAUTH_REFRESH_TOKEN");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    const message =
      payload?.error_description ||
      payload?.error ||
      `Token exchange failed (${response.status})`;
    throw new Error(message);
  }
  return payload.access_token;
}

async function inspectAccessTokenScopes(accessToken) {
  const url = new URL("https://oauth2.googleapis.com/tokeninfo");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload?.error_description ||
      payload?.error ||
      `tokeninfo failed (${response.status})`;
    throw new Error(message);
  }
  const scopeText = String(payload.scope || "").trim();
  const scopes = scopeText ? scopeText.split(/\s+/).sort() : [];
  return { scopes, payload };
}

async function main() {
  const accessToken = await exchangeRefreshTokenForAccessToken();
  const { scopes } = await inspectAccessTokenScopes(accessToken);

  const requiredAdsScope = "https://www.googleapis.com/auth/adwords";
  const requiredSearchConsoleScope =
    "https://www.googleapis.com/auth/webmasters.readonly";

  const hasAdsScope = scopes.includes(requiredAdsScope);
  const hasSearchConsoleScope = scopes.includes(requiredSearchConsoleScope);

  console.log("\nDetected OAuth scopes:\n");
  if (scopes.length === 0) {
    console.log("(none)");
  } else {
    for (const scope of scopes) {
      console.log(`- ${scope}`);
    }
  }

  console.log("\nScope checks:");
  console.log(`- Google Ads (adwords): ${hasAdsScope ? "YES" : "NO"}`);
  console.log(
    `- Search Console (webmasters.readonly): ${hasSearchConsoleScope ? "YES" : "NO"}`,
  );

  if (!hasAdsScope) {
    console.log(
      "\nAction needed: regenerate GOOGLE_OAUTH_REFRESH_TOKEN with scope https://www.googleapis.com/auth/adwords",
    );
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error("Failed to check Google OAuth scopes.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
