import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RemoveBody = {
  clientIds?: number[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RemoveBody;
  try {
    body = (await request.json()) as RemoveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientIds = (body.clientIds ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (!clientIds.length) {
    return NextResponse.json({ error: "No client IDs provided." }, { status: 400 });
  }

  const results: Array<{ id: number; ok: boolean; accountName?: string; error?: string }> = [];

  for (const clientId of clientIds) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("id,account_name")
      .eq("id", clientId)
      .maybeSingle();

    if (!clientRow) {
      results.push({ id: clientId, ok: false, error: "Client not found." });
      continue;
    }

    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) {
      results.push({
        id: clientId,
        ok: false,
        accountName: clientRow.account_name,
        error: error.message,
      });
    } else {
      results.push({
        id: clientId,
        ok: true,
        accountName: clientRow.account_name,
      });
    }
  }

  return NextResponse.json({
    ok: results.every((row) => row.ok),
    results,
    removed: results.filter((row) => row.ok).length,
  });
}
