import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/profile";
import { applyTaskChanges, parseTaskChange, TaskChangeError, type TaskChange } from "@/lib/assistant/task-changes";
import { createClient } from "@/lib/supabase/server";

/**
 * Applying a proposal you confirmed.
 *
 * Runs through your own login, so row-level security confines it to your
 * tasks. The changes are re-validated here: they came back from the browser,
 * and a proposal is only ever what the model suggested.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { changes?: unknown } | null;
  if (!Array.isArray(body?.changes) || body.changes.length === 0 || body.changes.length > 30) {
    return NextResponse.json({ error: "Send between 1 and 30 changes." }, { status: 400 });
  }

  let changes: TaskChange[];
  try {
    changes = body.changes.map(parseTaskChange);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof TaskChangeError ? error.message : "Invalid change." },
      { status: 400 },
    );
  }

  const result = await applyTaskChanges(supabase, profile.id, changes);
  return NextResponse.json(
    {
      applied: result.applied.map((item) => ({ taskId: item.taskId, title: item.title, action: item.change.action })),
      undo: result.applied.map((item) => item.undo),
      error: result.error,
    },
    // Partial success is still success for what applied; the page shows both.
    { status: result.error && result.applied.length === 0 ? 400 : 200 },
  );
}
