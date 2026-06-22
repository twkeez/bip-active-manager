// Audits which clients' GA4 properties the service account can actually reach.
//
// GA4 sync authenticates as the service account (GOOGLE_SERVICE_ACCOUNT_*). A
// client only syncs if that account has access to its GA4 property — which means
// the property must live under a GA4 account the service account was added to.
// This script checks every client's stored ga4_property_id against the GA4 Admin
// API and prints a punch list of reachable vs. no-access vs. unconfigured.
//
// Usage: node --env-file=.env.local scripts/ga4-access-audit.mjs

import { createClient } from "@supabase/supabase-js";
import { JWT } from "google-auth-library";

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function resolvePropertyId(client) {
  // Mirror the sync route: prefer ga4_property_id, fall back to ga4_id.
  return (client.ga4_property_id || client.ga4_id || "")
    .replace(/^properties\//, "")
    .trim();
}

async function main() {
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id,account_name,ga4_property_id,ga4_id")
    .order("account_name", { ascending: true });
  if (error) throw new Error(`DB error: ${error.message}`);

  const jwt = new JWT({
    email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL"),
    key: requiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: [GA4_SCOPE],
  });
  const tokenResponse = await jwt.getAccessToken();
  const token =
    typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error("Failed to acquire a Google access token.");

  const reachable = [];
  const noAccess = [];
  const badId = [];
  const notConfigured = [];

  for (const client of clients) {
    const property = resolvePropertyId(client);
    if (!property) {
      notConfigured.push(client);
      continue;
    }
    if (!/^\d+$/.test(property)) {
      badId.push({ ...client, property });
      continue;
    }
    const res = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${property}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.status === 200) {
      reachable.push({ ...client, property });
    } else if (res.status === 403) {
      noAccess.push({ ...client, property });
    } else {
      const body = (await res.text()).slice(0, 80);
      noAccess.push({ ...client, property, note: `HTTP ${res.status}: ${body}` });
    }
    await new Promise((resolve) => setTimeout(resolve, 60)); // gentle on the API
  }

  const line = (c) =>
    `  - ${c.account_name} (id ${c.id}, property ${c.property}${c.note ? `, ${c.note}` : ""})`;

  console.log(
    `\n=== GA4 ACCESS AUDIT — ${clients.length} clients, ${reachable.length + noAccess.length} with numeric property IDs checked ===`,
  );
  console.log(`\n✅ REACHABLE (sync will work): ${reachable.length}`);
  reachable.forEach((c) => console.log(line(c)));
  console.log(
    `\n❌ NO ACCESS (add ${requiredEnv("GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL")} as Viewer on the property): ${noAccess.length}`,
  );
  noAccess.forEach((c) => console.log(line(c)));
  if (badId.length > 0) {
    console.log(
      `\n⚠️  ga4_property_id is not numeric (looks misconfigured): ${badId.length}`,
    );
    badId.forEach((c) =>
      console.log(
        `  - ${c.account_name} (id ${c.id}, ga4_property_id="${c.property}", ga4_id="${c.ga4_id ?? ""}")`,
      ),
    );
  }
  console.log(`\n— NOT CONFIGURED (no ga4_property_id): ${notConfigured.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
