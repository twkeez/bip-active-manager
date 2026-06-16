import type { UserTaskPerson } from "@/lib/types/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FIXED_TASK_ASSIGNEE_NAMES = [
  "Alex",
  "Stephanie",
  "Melissa",
  "Stephanie/Melissa",
] as const;

function normalizePersonName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function sortByFixedRoster(people: UserTaskPerson[]) {
  const order = new Map(
    FIXED_TASK_ASSIGNEE_NAMES.map((name, index) => [normalizePersonName(name), index]),
  );
  return [...people].sort((left, right) => {
    const leftOrder = order.get(normalizePersonName(left.name)) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(normalizePersonName(right.name)) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.name.localeCompare(right.name);
  });
}

export async function ensureFixedTaskPeople(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserTaskPerson[]> {
  const allowedKeys = new Set(
    FIXED_TASK_ASSIGNEE_NAMES.map((name) => normalizePersonName(name)),
  );
  const { data: existingRaw, error: existingError } = await supabase
    .from("user_task_people")
    .select("*")
    .eq("owner_user_id", userId);
  if (existingError) {
    throw new Error(existingError.message);
  }

  const existing = (existingRaw ?? []) as UserTaskPerson[];
  const byName = new Map<string, UserTaskPerson>();
  const deleteIds: number[] = [];
  for (const person of existing) {
    const key = normalizePersonName(person.name);
    if (!allowedKeys.has(key)) {
      deleteIds.push(person.id);
      continue;
    }
    if (byName.has(key)) {
      deleteIds.push(person.id);
      continue;
    }
    byName.set(key, person);
  }

  for (const name of FIXED_TASK_ASSIGNEE_NAMES) {
    const key = normalizePersonName(name);
    if (byName.has(key)) continue;
    const nowIso = new Date().toISOString();
    const { data: insertedRaw, error: insertError } = await supabase
      .from("user_task_people")
      .insert({
        owner_user_id: userId,
        name,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();
    if (insertError || !insertedRaw) {
      throw new Error(insertError?.message ?? "Failed to create assignee person");
    }
    byName.set(key, insertedRaw as UserTaskPerson);
  }

  if (deleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("user_task_people")
      .delete()
      .eq("owner_user_id", userId)
      .in("id", deleteIds);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  return sortByFixedRoster([...byName.values()]);
}
