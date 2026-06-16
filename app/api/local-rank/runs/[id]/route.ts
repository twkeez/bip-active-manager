import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function parseRunId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const runId = parseRunId(id);
  if (!runId) {
    return NextResponse.json({ error: "Valid run id is required" }, { status: 400 });
  }

  const { data: run, error: runError } = await supabase
    .from("local_rank_grid_runs")
    .select("*")
    .eq("id", runId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 500 });
  }
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  const { data: cells, error: cellsError } = await supabase
    .from("local_rank_grid_cells")
    .select("*")
    .eq("run_id", runId)
    .order("keyword")
    .order("row_idx")
    .order("col_idx");

  if (cellsError) {
    return NextResponse.json({ error: cellsError.message }, { status: 500 });
  }

  return NextResponse.json({ run, cells: cells ?? [] });
}
