import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { listCustomCanaries } from "@/lib/coal-mines/custom-canaries";
import { assertReadOnlyQuery, UnsafeQueryError } from "@/lib/coal-mines/query-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/profile";

/** Listing the canaries somebody wrote, and saving a new one. */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function GET() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  try {
    const canaries = await listCustomCanaries(createAdminClient(), { enabledOnly: false });
    return NextResponse.json({ canaries });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load canaries." },
      { status: 500 },
    );
  }
}

type SaveBody = {
  name?: string;
  watches?: string;
  instruction?: string;
  sql?: string;
  headlineNone?: string;
  headlineSome?: string;
  itemLabelColumn?: string;
  itemMetaColumns?: string[];
  hrefTemplate?: string | null;
  severity?: "attention" | "overdue";
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as SaveBody | null;
  const name = body?.name?.trim();
  const watches = body?.watches?.trim();
  const instruction = body?.instruction?.trim();
  const headlineNone = body?.headlineNone?.trim();
  const headlineSome = body?.headlineSome?.trim();
  const itemLabelColumn = body?.itemLabelColumn?.trim();

  if (!name || !watches || !instruction || !headlineNone || !headlineSome || !itemLabelColumn) {
    return NextResponse.json({ error: "The canary is missing something." }, { status: 400 });
  }

  // Guarded again on the way in. The draft endpoint already checked, but a save
  // can be posted directly and the query is about to be stored and run nightly.
  let sql: string;
  try {
    sql = assertReadOnlyQuery(body?.sql ?? "");
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof UnsafeQueryError ? error.message : "That query cannot be saved.",
      },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  // The slug is what the board keys on; a collision would have one canary
  // quietly replace another on the page.
  const base = slugify(name) || "canary";
  const { data: existing } = await admin
    .from("coal_mine_canaries")
    .select("key")
    .like("key", `${base}%`);
  const taken = new Set((existing ?? []).map((row) => row.key as string));
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;

  const { data, error } = await admin
    .from("coal_mine_canaries")
    .insert({
      key,
      name,
      watches,
      instruction,
      query_sql: sql,
      headline_none: headlineNone,
      headline_some: headlineSome,
      item_label_column: itemLabelColumn,
      item_meta_columns: body?.itemMetaColumns ?? [],
      href_template: body?.hrefTemplate?.trim() || null,
      severity: body?.severity === "overdue" ? "overdue" : "attention",
      created_by: profile.email,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ canary: data });
}
