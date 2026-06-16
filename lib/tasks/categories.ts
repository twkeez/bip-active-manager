import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserTaskCategory } from "@/lib/types/client";
import {
  DEFAULT_TASK_CATEGORY_NAMES,
  normalizeCategoryName,
} from "@/lib/tasks/shared";

export async function listTaskCategories(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_task_categories")
    .select("*")
    .eq("owner_user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as UserTaskCategory[];
}

export async function ensureDefaultTaskCategories(
  supabase: SupabaseClient,
  userId: string,
) {
  const existing = await listTaskCategories(supabase, userId);
  const existingByLower = new Set(
    existing.map((category) => category.name.trim().toLowerCase()),
  );
  const missing = DEFAULT_TASK_CATEGORY_NAMES.filter(
    (name) => !existingByLower.has(name.toLowerCase()),
  );
  if (missing.length === 0) return existing;

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("user_task_categories").insert(
    missing.map((name) => ({
      owner_user_id: userId,
      name,
      created_at: nowIso,
      updated_at: nowIso,
    })),
  );
  if (error && !/duplicate key value|unique constraint/i.test(error.message)) {
    throw error;
  }
  return listTaskCategories(supabase, userId);
}

export function validateCategoryName(value: unknown) {
  const name = normalizeCategoryName(value);
  if (!name) return { valid: false as const, error: "Category name is required" };
  if (name.length > 80) {
    return { valid: false as const, error: "Category name is too long" };
  }
  return { valid: true as const, name };
}
