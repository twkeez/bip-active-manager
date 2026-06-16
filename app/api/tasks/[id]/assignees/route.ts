import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOwnedTaskOrThrow, parsePositiveInt } from "@/lib/tasks/task-access";
import { ensureFixedTaskPeople } from "@/lib/tasks/people";
import type { UserTaskPerson } from "@/lib/types/client";

type SetAssigneesBody = {
  personIds?: number[];
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const taskId = parsePositiveInt(params.id);
  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await fetchOwnedTaskOrThrow(supabase, taskId, user.id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let body: SetAssigneesBody;
  try {
    body = (await request.json()) as SetAssigneesBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const personIds = Array.isArray(body.personIds)
    ? [...new Set(body.personIds.filter((id) => Number.isInteger(id) && id > 0))]
    : [];

  const people = (await ensureFixedTaskPeople(supabase, user.id)) as UserTaskPerson[];
  const validPersonIds = new Set(people.map((person) => person.id));
  if (personIds.some((id) => !validPersonIds.has(id))) {
    return NextResponse.json(
      { error: "One or more assignees are invalid" },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();
  const { error: deleteError } = await supabase
    .from("user_task_assignees")
    .delete()
    .eq("owner_user_id", user.id)
    .eq("task_id", task.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (personIds.length > 0) {
    const { error: insertError } = await supabase.from("user_task_assignees").insert(
      personIds.map((personId) => ({
        owner_user_id: user.id,
        task_id: task.id,
        person_id: personId,
        created_at: nowIso,
      })),
    );
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const selectedPeople = people.filter((person) => personIds.includes(person.id));
  return NextResponse.json({ assignees: selectedPeople });
}
