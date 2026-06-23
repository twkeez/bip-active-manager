// Derives clients.strategist_user_ids from the marketing_strategist text field,
// so mixed assignments ("Daniel/Tom", "Melissa/Stephanie") become visible to
// every named strategist, and "Low Contact" goes to Alex. Idempotent — safe to
// re-run after re-tagging clients.
//
// Usage: node --env-file=.env.local scripts/sync-client-strategists.mjs
//        add --dry to preview without writing.

import { createClient } from "@supabase/supabase-js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

// Map a strategist display name (as used in marketing_strategist) to the
// account email that owns those clients. Email is unambiguous (the profile
// full_name "tom" collides with the admin "Tom").
const NAME_TO_EMAIL = {
  alex: "alex@beyondindigo.com",
  daniel: "daniel@beyondindigo.com",
  melissa: "melissa@beyondindigo.com",
  stephanie: "stephanie@beyondindigo.com",
  tom: "tom@beyondindigo.com",
  elyse: "elyse@beyondindigo.com",
  beth: "beth@beyondindigo.com", // no account yet — will be skipped
};

// marketing_strategist values that are not real strategist assignments.
const NON_STRATEGIST = new Set(["website only", "onboarding", "dont know", "don't know", ""]);

/** Returns the list of strategist display names a client should be visible to. */
function strategistNamesFor(raw) {
  const value = (raw ?? "").trim();
  const lower = value.toLowerCase();
  if (NON_STRATEGIST.has(lower)) return [];
  if (lower === "low contact") return ["Alex"];
  return value.split("/").map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const dry = process.argv.includes("--dry");
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Resolve name → user id via email.
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email");
  if (pErr) throw new Error(`profiles: ${pErr.message}`);
  const idByEmail = new Map((profiles ?? []).map((p) => [p.email?.toLowerCase(), p.id]));

  const idForName = (name) => {
    const email = NAME_TO_EMAIL[name.trim().toLowerCase()];
    return email ? idByEmail.get(email) ?? null : null;
  };

  const { data: clients, error: cErr } = await supabase
    .from("clients")
    .select("id, account_name, marketing_strategist");
  if (cErr) throw new Error(`clients: ${cErr.message}`);

  const unmatched = new Map(); // name -> count (named strategists with no account)
  const perStrategist = new Map(); // email -> count
  let assigned = 0;
  let cleared = 0;
  let failed = 0;

  for (const client of clients ?? []) {
    const names = strategistNamesFor(client.marketing_strategist);
    const ids = [];
    for (const name of names) {
      const id = idForName(name);
      if (id) {
        if (!ids.includes(id)) ids.push(id);
        const email = NAME_TO_EMAIL[name.toLowerCase()];
        perStrategist.set(email, (perStrategist.get(email) ?? 0) + 1);
      } else {
        unmatched.set(name, (unmatched.get(name) ?? 0) + 1);
      }
    }
    if (ids.length > 0) assigned++;
    else cleared++;

    if (!dry) {
      const { error } = await supabase
        .from("clients")
        .update({ strategist_user_ids: ids })
        .eq("id", client.id);
      if (error) {
        failed++;
        console.error(`  ! ${client.account_name} (id ${client.id}): ${error.message}`);
      }
    }
  }

  console.log(`\n=== sync-client-strategists ${dry ? "(DRY RUN)" : ""} ===`);
  console.log(`Clients with ≥1 strategist: ${assigned}`);
  console.log(`Clients left admin-only:    ${cleared}`);
  if (failed) console.log(`Update failures:            ${failed}`);
  console.log(`\nAssignments per strategist:`);
  for (const [email, count] of [...perStrategist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(3)}  ${email}`);
  }
  if (unmatched.size > 0) {
    console.log(`\nNamed strategists with NO account (skipped — invite them to grant access):`);
    for (const [name, count] of unmatched) console.log(`  ${count.toString().padStart(3)}  ${name}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
