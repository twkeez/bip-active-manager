import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildOnboardingEvaluations,
  summarizeOnboardingQueue,
} from "@/lib/clients/onboarding";
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
  const status = url.searchParams.get("status") ?? "active";

  let query = supabase.from("clients").select("*").order("account_name", { ascending: true });
  if (status === "active") {
    query = query.eq("onboarding_status", "active");
  } else if (status === "complete") {
    query = query.eq("onboarding_status", "complete");
  } else if (status === "not_started") {
    query = query.is("onboarding_status", null);
  }

  const { data: clientsRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clients = (clientsRaw ?? []) as ClientRow[];
  const evaluations = await buildOnboardingEvaluations(supabase, user.id, clients);
  evaluations.sort((a, b) => b.urgencyScore - a.urgencyScore);

  return NextResponse.json({
    summary: summarizeOnboardingQueue(evaluations),
    clients: evaluations,
  });
}
