// Fills clients.city from each client's Google Place ID.
//
// The city is null for almost every client, which quietly weakens anything that
// needs a location — onboarding market research runs with an empty location and
// returns generic filler, and keyword suggestions lose their local grounding.
// Places Details turns a place ID into an address in one cheap call, so this is
// a one-time pass to make that data real.
//
// Clients with no place ID are left alone and listed at the end for you to
// handle by hand — guessing a location from a practice name is exactly the kind
// of plausible-but-wrong data that is worse than a blank.
//
// Usage: node --env-file=.env.local scripts/backfill-client-city.mjs
//        add --dry to preview without writing.
//        add --force to overwrite cities that are already set.

import { createClient } from "@supabase/supabase-js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

const norm = (v) => (v ?? "").toString().trim();

/** Google returns the city as a "locality" component; "postal_town" covers the UK. */
function cityFromComponents(components) {
  const byType = (type) =>
    components.find((c) => (c.types ?? []).includes(type))?.longText ?? null;
  return (
    byType("locality") ??
    byType("postal_town") ??
    // Townships and unincorporated areas ("Bloomfield Township, MI") carry no
    // locality at all, only this.
    byType("administrative_area_level_3") ??
    byType("sublocality") ??
    null
  );
}

/**
 * Last resort for addresses with no usable component: the formatted address is
 * reliably "street, city, STATE zip, country", so the city is the third segment
 * from the end.
 */
function cityFromFormattedAddress(formatted) {
  const parts = (formatted ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const candidate = parts[parts.length - 3];
  // Guard against a street address landing here on a two-line address.
  return /^\d/.test(candidate) ? null : candidate || null;
}

async function lookupCity(placeId, apiKey) {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "addressComponents,formattedAddress",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    return { error: `${res.status} ${body.slice(0, 120)}` };
  }

  const data = await res.json();
  const city =
    cityFromComponents(data.addressComponents ?? []) ??
    cityFromFormattedAddress(data.formattedAddress);
  return city
    ? { city, address: data.formattedAddress ?? null }
    : { error: `no locality in ${data.formattedAddress ?? "response"}` };
}

async function main() {
  const dry = process.argv.includes("--dry");
  const force = process.argv.includes("--force");
  const apiKey = requiredEnv("GOOGLE_MAPS_API_KEY");

  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, account_name, city, google_place_id")
    .order("account_name", { ascending: true });
  if (error) throw new Error(`clients: ${error.message}`);

  const noPlaceId = [];
  const skipped = [];
  const failed = [];
  let updated = 0;

  for (const client of clients ?? []) {
    const placeId = norm(client.google_place_id);
    const existingCity = norm(client.city);

    if (!placeId) {
      noPlaceId.push(client);
      continue;
    }
    if (existingCity && !force) {
      skipped.push(client);
      continue;
    }

    const result = await lookupCity(placeId, apiKey);
    if (result.error) {
      failed.push({ client, reason: result.error });
      continue;
    }

    console.log(
      `${dry ? "[dry] " : ""}${client.account_name} → ${result.city}` +
        (existingCity ? `  (was "${existingCity}")` : ""),
    );

    if (!dry) {
      const { error: updateError } = await supabase
        .from("clients")
        .update({ city: result.city })
        .eq("id", client.id);
      if (updateError) {
        failed.push({ client, reason: updateError.message });
        continue;
      }
    }
    updated += 1;
  }

  console.log(`\n${"─".repeat(56)}`);
  console.log(`${dry ? "Would update" : "Updated"}: ${updated}`);
  console.log(`Already had a city (left alone): ${skipped.length}`);

  if (failed.length > 0) {
    console.log(`\nPlace ID lookup failed for ${failed.length}:`);
    for (const { client, reason } of failed) {
      console.log(`  ${client.id}  ${client.account_name} — ${reason}`);
    }
  }

  if (noPlaceId.length > 0) {
    console.log(`\nNo Google Place ID — city left blank for ${noPlaceId.length}:`);
    for (const client of noPlaceId) {
      console.log(`  ${client.id}  ${client.account_name}`);
    }
    console.log(
      "\nAdd a Place ID on the client's Profile tab and re-run to fill these in.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
