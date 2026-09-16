import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth/profile";
import { parseUndoOperation, TaskChangeError, undoTaskChanges, type UndoOperation } from "@/lib/assistant/task-changes";
import { createClient } from "@/lib/supabase/server";

/** Undoing a confirmed proposal. Deletes only tasks the assistant created. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const profile = await getProfile(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { undo?: unknown } | null;
  if (!Array.isArray(body?.undo) || body.undo.length === 0 || body.undo.length > 30) {
    return NextResponse.json({ error: "Nothing to undo." }, { status: 400 });
  }

  let operations: UndoOperation[];
  try {
    operations = body.undo.map(parseUndoOperation);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof TaskChangeError ? error.message : "Invalid undo." },
      { status: 400 },
    );
  }

  const result = await undoTaskChanges(supabase, profile.id, operations);
  return NextResponse.json(result, { status: result.error && result.undone === 0 ? 400 : 200 });
}
