import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserTask } from "@/lib/types/client";

export async function fetchOwnedTaskOrThrow(
  supabase: SupabaseClient,
  taskId: number,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as UserTask;
}

export function parsePositiveInt(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}
