import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startOnboardingForClient } from "@/lib/clients/onboarding";
import type { ClientInsert, ClientRow } from "@/lib/types/client";

type ImportBody = {
  rows?: ClientInsert[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }

  const cleaned = rows
    .map((row) => ({
      ...row,
      account_name: (row.account_name ?? "").trim(),
    }))
    .filter((row) => row.account_name.length > 0);

  if (!cleaned.length) {
    return NextResponse.json({ error: "No valid account names to import." }, { status: 400 });
  }

  const { data, error } = await supabase.from("clients").insert(cleaned).select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const importedClients = (data ?? []) as ClientRow[];
  for (const client of importedClients) {
    try {
      await startOnboardingForClient(supabase, client.id, user.id);
    } catch {
      // Continue importing remaining clients if one onboarding seed fails.
    }
  }

  const { data: refreshedClients } = await supabase
    .from("clients")
    .select("*")
    .in(
      "id",
      importedClients.map((client) => client.id),
    );

  return NextResponse.json({
    ok: true,
    imported: importedClients.length,
    clients: refreshedClients ?? importedClients,
  });
}
