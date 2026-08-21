// Checks that each client's Google Place ID actually points at that client.
//
// The Place ID is load-bearing: it drives Reputation (which reviews we read and
// analyse), GBP sync, and Local Rank. A wrong one is silent — the tool happily
// reports another business's reviews under your client's name — so nothing
// surfaces it until someone reads the output closely.
//
// The check is a domain comparison. Google returns the website it has on file
// for a place; if that doesn't match the website we have for the client, the two
// records are probably not the same business. Same-root-domain differences
// (booking.example.com vs example.com) pass.
//
// Read-only. It never writes — a wrong Place ID has to be replaced with the
// right one, and picking that is a judgement call, not something to guess.
//
// Usage: node --env-file=.env.local scripts/audit-client-place-ids.mjs
//        add --all to also list the clients that pass.

import { createClient } from "@supabase/supabase-js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function hostname(url) {
  const raw = (url ?? "").toString().trim();
  if (!raw) return null;
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

/** example.co.uk is out of scope here; these are US/CA practices. */
function rootDomain(host) {
  return host ? host.split(".").slice(-2).join(".") : null;
}

async function fetchPlace(placeId, apiKey) {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "displayName,formattedAddress,websiteUri",
      },
    },
  );
  if (!res.ok) return { error: `lookup failed (${res.status})` };
  return { place: await res.json() };
}

async function main() {
  const showAll = process.argv.includes("--all");
  const apiKey = requiredEnv("GOOGLE_MAPS_API_KEY");

  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, account_name, city, website, google_place_id")
    .order("account_name", { ascending: true });
  if (error) throw new Error(`clients: ${error.message}`);

  const mismatched = [];
  const unverifiable = [];
  const missingPlaceId = [];
  let matched = 0;

  for (const client of clients ?? []) {
    const placeId = (client.google_place_id ?? "").trim();
    if (!placeId) {
      missingPlaceId.push(client);
      continue;
    }

    const { place, error: lookupError } = await fetchPlace(placeId, apiKey);
    if (lookupError) {
      mismatched.push({ client, reason: lookupError });
      continue;
    }

    const ours = hostname(client.website);
    const theirs = hostname(place.websiteUri);

    // Without a website on one side there is nothing to compare against; say so
    // rather than counting it as a pass.
    if (!ours || !theirs) {
      unverifiable.push({ client, place });
      continue;
    }

    if (ours === theirs || rootDomain(ours) === rootDomain(theirs)) {
      matched += 1;
      if (showAll) console.log(`ok    ${client.account_name} → ${theirs}`);
      continue;
    }

    mismatched.push({ client, place, ours, theirs });
  }

  console.log(`\n${"─".repeat(64)}`);
  console.log(`Verified against the client's website: ${matched}`);
  console.log(`Mismatched: ${mismatched.length}`);
  console.log(`Could not verify (no website one side): ${unverifiable.length}`);
  console.log(`No Place ID: ${missingPlaceId.length}`);

  if (mismatched.length > 0) {
    console.log(`\n=== Place ID points somewhere else ===`);
    for (const row of mismatched) {
      console.log(`\n  ${row.client.id}  ${row.client.account_name}`);
      console.log(`     our website:  ${row.client.website ?? "—"}`);
      if (row.reason) {
        console.log(`     ${row.reason}`);
        continue;
      }
      console.log(`     place is:     ${row.place.displayName?.text ?? "?"}`);
      console.log(`     place site:   ${row.theirs}`);
      console.log(`     place addr:   ${row.place.formattedAddress ?? "?"}`);
      console.log(`     our city now: ${row.client.city ?? "—"}`);
    }
    console.log(
      `\nFix by replacing google_place_id on the client's Profile tab, then re-run.`,
    );
  }

  if (unverifiable.length > 0) {
    console.log(`\n=== Could not verify ===`);
    for (const row of unverifiable) {
      console.log(
        `  ${row.client.id}  ${row.client.account_name} — ours: ${row.client.website ?? "—"} / place: ${row.place.websiteUri ?? "—"} (${row.place.displayName?.text ?? "?"})`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
