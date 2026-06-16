import { createClient } from "@supabase/supabase-js";
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

function normalizeUrl(raw) {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const withProto = value.includes("://") ? value : `https://${value}`;
  try {
    const url = new URL(withProto);
    return `${url.protocol}//${url.host}${url.pathname || "/"}`;
  } catch {
    return "";
  }
}

function parseHost(rawWebsite) {
  const normalized = normalizeUrl(rawWebsite);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    const host = url.host.toLowerCase();
    const hostNoWww = host.replace(/^www\./, "");
    return { host, hostNoWww, normalized };
  } catch {
    return null;
  }
}

function isStrongPermission(permission) {
  return permission === "siteOwner" || permission === "siteFullUser";
}

function buildAuth() {
  const clientId = optionalEnv("GOOGLE_CLIENT_ID");
  const clientSecret = optionalEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri =
    optionalEnv("GOOGLE_REDIRECT_URI") ||
    "http://localhost:3000/api/integrations/google/callback";
  const refreshToken = optionalEnv("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (clientId && clientSecret && refreshToken) {
    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    auth.setCredentials({ refresh_token: refreshToken });
    return auth;
  }
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

function toProperty(entry) {
  const siteUrl = (entry.siteUrl ?? "").trim();
  const permission = entry.permissionLevel ?? "unknown";
  if (!siteUrl) return null;
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    if (!domain) return null;
    return {
      type: "domain",
      siteUrl,
      permission,
      domain,
      host: null,
      hostNoWww: null,
    };
  }
  const normalized = normalizeUrl(siteUrl);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    const host = parsed.host.toLowerCase();
    return {
      type: "url-prefix",
      siteUrl,
      permission,
      domain: null,
      host,
      hostNoWww: host.replace(/^www\./, ""),
    };
  } catch {
    return null;
  }
}

function scoreCandidate(clientHost, property) {
  let baseScore = 0;
  if (property.type === "url-prefix") {
    if (property.host === clientHost.host) baseScore = 120;
    else if (property.hostNoWww === clientHost.hostNoWww) baseScore = 110;
  } else if (property.type === "domain") {
    const exact = clientHost.hostNoWww === property.domain;
    const sub = clientHost.hostNoWww.endsWith(`.${property.domain}`);
    if (exact) baseScore = 105;
    else if (sub) baseScore = 100;
  }
  if (baseScore === 0) return 0;
  let score = baseScore;
  if (isStrongPermission(property.permission)) score += 10;
  else if (property.permission === "siteUnverifiedUser") score -= 20;
  return score;
}

function chooseBestProperty(clientHost, properties) {
  const ranked = properties
    .map((property) => ({
      property,
      score: scoreCandidate(clientHost, property),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0] ?? null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const includeUnverified = process.argv.includes("--include-unverified");

  const auth = buildAuth();
  const searchconsole = google.searchconsole("v1");
  const sitesResponse = await searchconsole.sites.list({ auth });
  const rawSites = sitesResponse.data.siteEntry ?? [];
  const properties = rawSites
    .map(toProperty)
    .filter((property) => property != null)
    .filter((property) => includeUnverified || isStrongPermission(property.permission));

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id,account_name,website,sc_url")
    .order("account_name", { ascending: true });
  if (error) {
    throw new Error(`Failed to load clients: ${error.message}`);
  }

  const rows = [];
  for (const client of clients ?? []) {
    const host = parseHost(client.website);
    if (!host) {
      rows.push({
        id: client.id,
        account_name: client.account_name,
        website: client.website ?? "",
        current_sc_url: client.sc_url ?? "",
        suggested_sc_url: "",
        permission: "",
        status: "no_website",
      });
      continue;
    }
    const chosen = chooseBestProperty(host, properties);
    if (!chosen) {
      rows.push({
        id: client.id,
        account_name: client.account_name,
        website: client.website ?? "",
        current_sc_url: client.sc_url ?? "",
        suggested_sc_url: "",
        permission: "",
        status: "no_match",
      });
      continue;
    }
    const current = (client.sc_url ?? "").trim();
    const suggested = chosen.property.siteUrl;
    const status = current === suggested ? "already_set" : "suggested";
    rows.push({
      id: client.id,
      account_name: client.account_name,
      website: client.website ?? "",
      current_sc_url: current,
      suggested_sc_url: suggested,
      permission: chosen.property.permission,
      status,
    });
  }

  const suggested = rows.filter((row) => row.status === "suggested");
  const already = rows.filter((row) => row.status === "already_set");
  const noMatch = rows.filter((row) => row.status === "no_match");
  const noWebsite = rows.filter((row) => row.status === "no_website");

  console.log(`\nProperties considered: ${properties.length}`);
  console.log(`Clients scanned: ${rows.length}`);
  console.log(`Already set: ${already.length}`);
  console.log(`Suggested updates: ${suggested.length}`);
  console.log(`No match: ${noMatch.length}`);
  console.log(`No website: ${noWebsite.length}\n`);

  if (suggested.length > 0) {
    console.log("Top suggested updates:");
    for (const row of suggested.slice(0, 40)) {
      console.log(
        `- [${row.permission}] ${row.account_name} -> ${row.suggested_sc_url} (current: ${row.current_sc_url || "empty"})`,
      );
    }
    if (suggested.length > 40) {
      console.log(`...and ${suggested.length - 40} more`);
    }
  }

  if (!apply) {
    console.log(
      "\nDry run only. Re-run with --apply to update clients.sc_url for suggested rows.",
    );
    return;
  }

  let updated = 0;
  for (const row of suggested) {
    const { error: updateError } = await supabase
      .from("clients")
      .update({ sc_url: row.suggested_sc_url })
      .eq("id", row.id);
    if (updateError) {
      console.error(
        `Failed to update client ${row.id} (${row.account_name}): ${updateError.message}`,
      );
      continue;
    }
    updated += 1;
  }
  console.log(`\nUpdated ${updated} client rows.`);
}

main().catch((error) => {
  console.error("Failed to reconcile Search Console properties.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
