import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { SERVICE_EXPECTATION_ORDER } from "@/lib/onboarding/service-expectations";
import type { GlossaryTerm } from "@/lib/onboarding/expectation-glossary";
import type { ClientServiceKey } from "@/lib/clients/types";

const VALID_SERVICES = new Set<string>(SERVICE_EXPECTATION_ORDER);

type Row = {
  id: number;
  term: string;
  definition: string;
  services: string[] | null;
  sort_order: number;
};

const toTerm = (row: Row): GlossaryTerm => ({
  id: row.id,
  term: row.term,
  definition: row.definition,
  services: (row.services ?? []) as ClientServiceKey[],
  sortOrder: row.sort_order,
});

async function readAll(client: ReturnType<typeof createAdminClient>) {
  const { data, error } = await client
    .from("expectation_glossary")
    .select("id, term, definition, services, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(toTerm);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json({ terms: await readAll(createAdminClient()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read the glossary" },
      { status: 500 },
    );
  }
}

/**
 * Replaces the whole glossary.
 *
 * The editor works on the list as a whole — terms get added, reworded, reordered
 * and deleted together — so sending the finished list is simpler and safer than
 * reconciling individual edits, and a delete cannot be lost.
 */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: { terms?: Array<{ term?: string; definition?: string; services?: string[] }> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const seen = new Set<string>();
  const rows: Array<{ term: string; definition: string; services: string[]; sort_order: number }> = [];
  for (const entry of body.terms ?? []) {
    const term = (entry?.term ?? "").trim();
    const definition = (entry?.definition ?? "").trim();
    // A half-typed row is not an error — it is a row still being written.
    if (!term || !definition) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      term,
      definition,
      services: (entry?.services ?? []).filter((s) => VALID_SERVICES.has(s)),
      sort_order: rows.length * 10,
    });
  }

  const admin = createAdminClient();
  const { error: clearError } = await admin.from("expectation_glossary").delete().gte("id", 0);
  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });

  if (rows.length > 0) {
    const { error } = await admin.from("expectation_glossary").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    return NextResponse.json({ ok: true, terms: await readAll(admin) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Saved, but could not re-read" },
      { status: 500 },
    );
  }
}
