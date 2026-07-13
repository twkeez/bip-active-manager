export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return { url, key };
}

export function getSupabaseServiceRoleConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const normalizedKey = (key ?? "").trim();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  const looksLikeLegacyJwt =
    normalizedKey.split(".").length === 3 && normalizedKey.startsWith("eyJ");
  const looksLikeSecretApiKey = normalizedKey.startsWith("sb_secret_");
  if (!looksLikeLegacyJwt && !looksLikeSecretApiKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY has invalid format. Use the Service Role secret key from Supabase project API settings (usually starts with sb_secret_).",
    );
  }
  return { url, key };
}

export function getBasecampOAuthConfig() {
  const clientId = process.env.BASECAMP_CLIENT_ID;
  const clientSecret = process.env.BASECAMP_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl.replace(/\/$/, "")}/api/basecamp/oauth/callback`;
  const domains = process.env.INTERNAL_EMAIL_DOMAINS ?? "";
  const internalDomains = domains
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!clientId || !clientSecret) {
    throw new Error("Missing BASECAMP_CLIENT_ID or BASECAMP_CLIENT_SECRET");
  }
  return { clientId, clientSecret, appUrl, redirectUri, internalDomains };
}

// Separate Basecamp OAuth app for the Illuminare portfolio (its own 37signals
// account/login), kept fully independent from the vet-side connection above.
export function getIlluminareBasecampOAuthConfig() {
  const clientId = process.env.ILLUMINARE_BASECAMP_CLIENT_ID;
  const clientSecret = process.env.ILLUMINARE_BASECAMP_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl.replace(/\/$/, "")}/api/illuminare/basecamp/oauth/callback`;
  const domains = process.env.INTERNAL_EMAIL_DOMAINS ?? "";
  const internalDomains = domains
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing ILLUMINARE_BASECAMP_CLIENT_ID or ILLUMINARE_BASECAMP_CLIENT_SECRET",
    );
  }
  return { clientId, clientSecret, appUrl, redirectUri, internalDomains };
}

export function getGmailOAuthConfig() {
  const clientId = normalizeSecret(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = normalizeSecret(process.env.GOOGLE_CLIENT_SECRET);
  const appUrl = normalizeSecret(process.env.NEXT_PUBLIC_APP_URL) || "http://localhost:3000";
  const redirectUri = `${appUrl.replace(/\/$/, "")}/api/gmail/oauth/callback`;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }
  return { clientId, clientSecret, appUrl, redirectUri };
}

function normalizeSecret(raw: string | undefined) {
  if (raw == null) return "";
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function getInternalEmailDomains() {
  return (process.env.INTERNAL_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function getInternalEmails() {
  return (process.env.INTERNAL_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function getBasecampClassicConfig() {
  const accountId = normalizeSecret(process.env.BASECAMP_ACCOUNT_ID);
  const token = normalizeSecret(process.env.BASECAMP_ACCESS_TOKEN);
  const basicUser =
    normalizeSecret(process.env.BASECAMP_BASIC_USER) ||
    normalizeSecret(process.env.BASECAMP_USER_EMAIL);
  const basicPassword = normalizeSecret(process.env.BASECAMP_PASSWORD);
  if (!accountId) {
    throw new Error("Missing BASECAMP_ACCOUNT_ID for Basecamp 2 auth mode");
  }
  if (!token && (!basicUser || !basicPassword)) {
    throw new Error(
      "Missing Basecamp 2 credentials. Set BASECAMP_ACCESS_TOKEN or BASECAMP_USER_EMAIL/BASECAMP_BASIC_USER + BASECAMP_PASSWORD.",
    );
  }
  return { accountId, token, basicUser, basicPassword };
}

export function getGooglePageSpeedApiKey() {
  const key = normalizeSecret(process.env.GOOGLE_PAGESPEED_API_KEY);
  if (!key) {
    throw new Error("Missing GOOGLE_PAGESPEED_API_KEY");
  }
  return key;
}

export function getGoogleServiceAccountConfig() {
  const clientEmail = normalizeSecret(
    process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
  );
  const privateKey = normalizeSecret(
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  ).replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    );
  }
  return { clientEmail, privateKey };
}

export function getGoogleOAuthRefreshConfig() {
  const clientId = normalizeSecret(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = normalizeSecret(process.env.GOOGLE_CLIENT_SECRET);
  const refreshToken = normalizeSecret(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
  const redirectUri =
    normalizeSecret(process.env.GOOGLE_REDIRECT_URI) ||
    "http://localhost:3000/api/integrations/google/callback";

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken, redirectUri };
}

export function getMetaGraphConfig() {
  const accessToken = normalizeSecret(process.env.META_GRAPH_ACCESS_TOKEN);
  const appId = normalizeSecret(process.env.META_APP_ID);
  const appSecret = normalizeSecret(process.env.META_APP_SECRET);
  if (!accessToken) {
    throw new Error("Missing META_GRAPH_ACCESS_TOKEN");
  }
  return { accessToken, appId, appSecret };
}

export function getGoogleAdsConfig() {
  const developerToken = normalizeSecret(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
  const loginCustomerId = normalizeSecret(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  const apiVersion = normalizeSecret(process.env.GOOGLE_ADS_API_VERSION) || "v21";
  if (!developerToken) {
    throw new Error("Missing GOOGLE_ADS_DEVELOPER_TOKEN");
  }
  return { developerToken, loginCustomerId, apiVersion };
}

export function getGeminiConfig() {
  const apiKey = normalizeSecret(
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY,
  );
  const model =
    normalizeSecret(process.env.GEMINI_MODEL) || "gemini-1.5-flash";
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY (or GOOGLE_GEMINI_API_KEY)");
  }
  return { apiKey, model };
}

export function getTaskEmailIngestConfig() {
  const secret = normalizeSecret(process.env.TASK_EMAIL_INGEST_SECRET);
  if (!secret) {
    throw new Error("Missing TASK_EMAIL_INGEST_SECRET");
  }
  return { secret };
}

export function getTaskEmailForwardingDomain() {
  return (
    normalizeSecret(process.env.TASK_EMAIL_FORWARDING_DOMAIN) || "tasks.local"
  );
}

export function getBigQueryConfig() {
  const projectId = normalizeSecret(process.env.GCP_PROJECT_ID);
  const dataset = normalizeSecret(process.env.BQ_DATASET);
  const clientEmail = normalizeSecret(process.env.GCP_SERVICE_ACCOUNT_CLIENT_EMAIL);
  const privateKey = normalizeSecret(
    process.env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY,
  ).replace(/\\n/g, "\n");
  if (!projectId || !dataset || !clientEmail || !privateKey) {
    throw new Error(
      "Missing BigQuery env vars. Set GCP_PROJECT_ID, BQ_DATASET, GCP_SERVICE_ACCOUNT_CLIENT_EMAIL, and GCP_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }
  return { projectId, dataset, clientEmail, privateKey };
}

export function getHarvestConfig() {
  const accessToken = normalizeSecret(process.env.HARVEST_ACCESS_TOKEN);
  const accountId = normalizeSecret(process.env.HARVEST_ACCOUNT_ID);
  const userAgent =
    normalizeSecret(process.env.HARVEST_USER_AGENT) ||
    "BIPClientManager (ops@beyondindigo.com)";
  if (!accessToken || !accountId) {
    return null;
  }
  return { accessToken, accountId, userAgent };
}

export function getDataForSeoConfig() {
  const login = normalizeSecret(process.env.DATAFORSEO_LOGIN);
  const password = normalizeSecret(process.env.DATAFORSEO_PASSWORD);
  if (!login || !password) {
    return null;
  }
  return { login, password };
}
