import { google } from "googleapis";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name) {
  const value = process.env[name];
  return value?.trim() ? value.trim() : "";
}

function buildUserAuthOrNull() {
  const clientId = optionalEnv("GOOGLE_CLIENT_ID");
  const clientSecret = optionalEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri =
    optionalEnv("GOOGLE_REDIRECT_URI") ||
    "http://localhost:3000/api/integrations/google/callback";
  const refreshToken = optionalEnv("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

function buildServiceAccountAuth() {
  const clientEmail = requiredEnv("GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL");
  const privateKey = requiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

async function main() {
  const auth = buildUserAuthOrNull() ?? buildServiceAccountAuth();

  const searchconsole = google.searchconsole("v1");
  const res = await searchconsole.sites.list({ auth });
  const sites = res.data.siteEntry ?? [];

  if (sites.length === 0) {
    console.log("No Search Console sites found for this account.");
    return;
  }

  console.log("Available Search Console sites:");
  for (const site of sites) {
    const url = site.siteUrl ?? "(unknown)";
    const permission = site.permissionLevel ?? "unknown";
    console.log(`- ${url} [${permission}]`);
  }
}

main().catch((error) => {
  console.error("Failed to list Search Console sites.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
