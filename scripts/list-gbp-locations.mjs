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

async function listAccounts(accessToken) {
  const response = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Accounts API failed (${response.status})`);
  }
  return payload.accounts ?? [];
}

async function listLocationsForAccount(accessToken, accountName) {
  const out = [];
  let nextPageToken = null;
  do {
    const url = new URL(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
    );
    url.searchParams.set("readMask", "name,title,storeCode,metadata");
    url.searchParams.set("pageSize", "100");
    if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        payload?.error?.message || `Locations API failed (${response.status})`,
      );
    }
    out.push(...(payload.locations ?? []));
    nextPageToken = payload.nextPageToken || null;
  } while (nextPageToken);
  return out;
}

async function main() {
  const accessToken = await exchangeRefreshTokenForAccessToken();
  const accounts = await listAccounts(accessToken);
  if (accounts.length === 0) {
    console.log("No GBP accounts found for current OAuth token.");
    return;
  }

  for (const account of accounts) {
    const accountName = account.name ?? "";
    if (!accountName) continue;
    console.log(`\nAccount: ${account.accountName ?? "(unnamed)"} (${accountName})`);
    const locations = await listLocationsForAccount(accessToken, accountName);
    if (locations.length === 0) {
      console.log("  (no locations)");
      continue;
    }
    for (const location of locations) {
      console.log(
        `- ${location.title ?? "(untitled)"} | placeId=${location.metadata?.placeId ?? "N/A"} | locationName=${location.name ?? "N/A"} | storeCode=${location.storeCode ?? "N/A"}`,
      );
    }
  }
}

main().catch((error) => {
  console.error("Failed to list GBP locations.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
