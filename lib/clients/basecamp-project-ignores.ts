import type { SupabaseClient } from "@supabase/supabase-js";

export type BasecampProjectIgnoreRow = {
  basecamp_project_id: string;
  project_name: string;
  reason: string | null;
  ignored_at: string;
  ignored_by: string | null;
};

export async function listBasecampProjectIgnores(
  supabase: SupabaseClient,
): Promise<BasecampProjectIgnoreRow[]> {
  const { data, error } = await supabase
    .from("basecamp_project_ignores")
    .select("*")
    .order("ignored_at", { ascending: false });
  if (error) {
    if (/does not exist|relation|could not find the table/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as BasecampProjectIgnoreRow[];
}

export async function ignoreBasecampProject(
  supabase: SupabaseClient,
  input: {
    projectId: string;
    projectName: string;
    reason?: string | null;
    ignoredBy?: string | null;
  },
): Promise<BasecampProjectIgnoreRow> {
  const { data, error } = await supabase
    .from("basecamp_project_ignores")
    .upsert(
      {
        basecamp_project_id: input.projectId.trim(),
        project_name: input.projectName.trim(),
        reason: input.reason?.trim() || "non_marketing",
        ignored_by: input.ignoredBy ?? null,
        ignored_at: new Date().toISOString(),
      },
      { onConflict: "basecamp_project_id" },
    )
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to ignore Basecamp project");
  }
  return data as BasecampProjectIgnoreRow;
}

export async function restoreBasecampProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<void> {
  const { error } = await supabase
    .from("basecamp_project_ignores")
    .delete()
    .eq("basecamp_project_id", projectId.trim());
  if (error) {
    throw new Error(error.message);
  }
}
