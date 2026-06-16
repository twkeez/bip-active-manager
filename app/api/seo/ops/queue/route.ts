import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildSeoOpsEvaluations } from "@/lib/seo/ops/load";
import { summarizeSeoOpsQueue } from "@/lib/seo/ops/evaluate";
import type { ClientRow } from "@/lib/types/client";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mineOnly = url.searchParams.get("mine") === "1";
  const userEmail = user.email ?? "";

  const { data: clientsRaw, error } = await supabase
    .from("clients")
    .select("*")
    .order("account_name", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let clients = (clientsRaw ?? []) as ClientRow[];
  if (mineOnly && userEmail) {
    const local = userEmail.split("@")[0]?.toLowerCase() ?? "";
    clients = clients.filter((client) => {
      const strategist = (client.marketing_strategist ?? "").toLowerCase();
      return strategist.includes(local) && local.length >= 2;
    });
  }

  const evaluations = await buildSeoOpsEvaluations(supabase, clients);
  return NextResponse.json({
    summary: summarizeSeoOpsQueue(evaluations),
    clients: evaluations,
  });
}
