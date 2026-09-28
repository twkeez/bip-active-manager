import type { SupabaseClient } from "@supabase/supabase-js";

export type DataWarning = {
  id: number;
  problem_key: string;
  kind: string;
  table_name: string | null;
  detail: string;
  rows_returned: number | null;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
};

/** A warning seen within this many days counts as active (banner, emails). */
export const ACTIVE_WARNING_DAYS = 7;

export function isActiveWarning(warning: Pick<DataWarning, "resolved_at" | "last_seen_at">, now: Date = new Date()): boolean {
  return (
    warning.resolved_at == null &&
    now.getTime() - new Date(warning.last_seen_at).getTime() <= ACTIVE_WARNING_DAYS * 86_400_000
  );
}

/** Every unresolved warning, newest first. Never throws: no table yet reads as none. */
export async function loadOpenWarnings(supabase: SupabaseClient): Promise<DataWarning[]> {
  const { data, error } = await supabase
    .from("data_warnings")
    .select("*")
    .is("resolved_at", null)
    .order("last_seen_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as DataWarning[];
}
