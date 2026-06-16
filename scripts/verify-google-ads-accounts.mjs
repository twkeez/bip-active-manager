import { createClient } from "@supabase/supabase-js";
import { OAuth2Client } from "google-auth-library";

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

function normalizeCustomerId(raw) {
  return String(raw ?? "").replace(/\D/g, "").trim();
}

function parseBodySafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function classifyFailure(status, bodyText) {
  const lower = bodyText.toLowerCase();
  if (status === 404) {
    return "not_found_or_not_linked";
  }
  if (status === 401 || lower.includes("unauthorized")) {
    return "auth_error";
  }
  if (
    status === 403 ||
    lower.includes("permission") ||
    lower.includes("access denied")
  ) {
    return "permission_error";
  }
  return "api_error";
}

async function getGoogleAccessToken() {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
  const refreshToken = requiredEnv("GOOGLE_OAUTH_REFRESH_TOKEN");
  const redirectUri =
    optionalEnv("GOOGLE_REDIRECT_URI") ||
    "http://localhost:3000/api/integrations/google/callback";
  const oauth = new OAuth2Client(clientId, clientSecret, redirectUri);
  oauth.setCredentials({ refresh_token: refreshToken });
  const tokenResponse = await oauth.getAccessToken();
  const token =
    typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token ?? null;
  if (!token) throw new Error("Failed to acquire Google OAuth access token.");
  return token;
}

async function verifyCustomer({
  accessToken,
  developerToken,
  loginCustomerId,
  customerId,
}) {
  const endpoint = `https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:searchStream`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
      ...(loginCustomerId ? { "login-customer-id": loginCustomerId } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "SELECT customer.id FROM customer LIMIT 1",
    }),
  });
  if (response.ok) {
    return { ok: true, status: response.status, reason: "ok", detail: "" };
  }

  const bodyText = await response.text();
  const parsed = parseBodySafe(bodyText);
  const parsedMessage =
    parsed?.error?.message ||
    parsed?.error?.details?.[0]?.message ||
    parsed?.error?.status ||
    "";
  const detail = parsedMessage || (bodyText.length > 220 ? `${bodyText.slice(0, 220)}...` : bodyText);
  return {
    ok: false,
    status: response.status,
    reason: classifyFailure(response.status, detail || bodyText),
    detail: detail || "Unknown API failure.",
  };
}

async function listAccessibleCustomers({ accessToken, developerToken, loginCustomerId }) {
  const apiVersion = optionalEnv("GOOGLE_ADS_API_VERSION") || "v20";
  const endpoint = `https://googleads.googleapis.com/${apiVersion}/customers:listAccessibleCustomers`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
      ...(loginCustomerId ? { "login-customer-id": loginCustomerId } : {}),
    },
  });
  if (!response.ok) {
    const bodyText = await response.text();
    const parsed = parseBodySafe(bodyText);
    const message =
      parsed?.error?.message ||
      parsed?.error?.details?.[0]?.message ||
      (bodyText.length > 220 ? `${bodyText.slice(0, 220)}...` : bodyText);
    throw new Error(
      `Failed to list accessible Google Ads customers (${response.status}) on ${apiVersion}: ${message}`,
    );
  }
  const payload = await response.json();
  const resourceNames = Array.isArray(payload?.resourceNames) ? payload.resourceNames : [];
  return resourceNames
    .map((name) => String(name).split("/").pop() || "")
    .map((id) => normalizeCustomerId(id))
    .filter((id) => /^\d{10}$/.test(id));
}

async function main() {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const developerToken = requiredEnv("GOOGLE_ADS_DEVELOPER_TOKEN");
  const loginCustomerId = normalizeCustomerId(optionalEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID"));
  const targetClientId = Number(optionalEnv("CLIENT_ID") || "0");

  if (loginCustomerId && !/^\d{10}$/.test(loginCustomerId)) {
    throw new Error(
      "GOOGLE_ADS_LOGIN_CUSTOMER_ID must be a 10-digit ID (dashes optional).",
    );
  }

  const accessToken = await getGoogleAccessToken();
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from("clients")
    .select("id,account_name,ads_customer_id")
    .order("account_name", { ascending: true });
  if (targetClientId > 0) {
    query = query.eq("id", targetClientId);
  }
  const { data: clients, error } = await query;
  if (error) {
    throw new Error(`Failed to load clients: ${error.message}`);
  }

  const accessibleCustomerIds = await listAccessibleCustomers({
    accessToken,
    developerToken,
    loginCustomerId,
  });
  const accessibleSet = new Set(accessibleCustomerIds);
  console.log(`\nAccessible Google Ads customers from current auth: ${accessibleCustomerIds.length}`);
  if (accessibleCustomerIds.length > 0) {
    console.log(
      `Sample accessible IDs: ${accessibleCustomerIds.slice(0, 15).join(", ")}${accessibleCustomerIds.length > 15 ? " ..." : ""}`,
    );
  }

  const rows = [];
  for (const client of clients ?? []) {
    const normalized = normalizeCustomerId(client.ads_customer_id);
    if (!normalized) {
      rows.push({
        id: client.id,
        account: client.account_name,
        customer_id: "",
        status: "missing",
        detail: "ads_customer_id is empty.",
      });
      continue;
    }
    if (!/^\d{10}$/.test(normalized)) {
      rows.push({
        id: client.id,
        account: client.account_name,
        customer_id: normalized,
        status: "invalid_format",
        detail: "Customer ID is not 10 digits.",
      });
      continue;
    }
    if (!accessibleSet.has(normalized)) {
      rows.push({
        id: client.id,
        account: client.account_name,
        customer_id: normalized,
        status: "not_accessible_in_context",
        detail:
          "Customer ID is not in customers:listAccessibleCustomers for current OAuth/developer token/login customer context.",
      });
      continue;
    }

    const verification = await verifyCustomer({
      accessToken,
      developerToken,
      loginCustomerId,
      customerId: normalized,
    });
    rows.push({
      id: client.id,
      account: client.account_name,
      customer_id: normalized,
      status: verification.ok ? "ok" : verification.reason,
      detail: verification.ok ? "Reachable via API." : verification.detail,
    });
  }

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    { total: 0 },
  );

  console.log("\nGoogle Ads account verification summary:");
  console.log(summary);
  console.log("");

  const failed = rows.filter((row) => row.status !== "ok");
  if (failed.length === 0) {
    console.log("All checked Ads customer IDs are reachable.");
    return;
  }

  console.log("Failures:");
  for (const row of failed) {
    console.log(
      `- [${row.status}] #${row.id} ${row.account} (${row.customer_id || "no id"}) -> ${row.detail}`,
    );
  }
}

main().catch((error) => {
  console.error("Failed to verify Google Ads accounts.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
