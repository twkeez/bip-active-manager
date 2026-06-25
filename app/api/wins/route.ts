import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { detectWins } from "@/lib/wins/detect";
import type { WinSource } from "@/lib/wins/types";

export const maxDuration = 60;

const VALID_SOURCES: WinSource[] = ["ads", "organic", "social"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const sourcesParam = url.searchParams.get("sources");
  const sources = sourcesParam
    ? (sourcesParam.split(",").filter((s): s is WinSource => VALID_SOURCES.includes(s as WinSource)))
    : undefined;

  try {
    const admin = createAdminClient();
    const wins = await detectWins(admin, { sources: sources?.length ? sources : undefined });
    return NextResponse.json({ wins });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to detect wins" },
      { status: 500 },
    );
  }
}
