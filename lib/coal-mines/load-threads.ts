import type { SupabaseClient } from "@supabase/supabase-js";
import { listBasecampProjectIgnores } from "@/lib/clients/basecamp-project-ignores";
import type { ThreadRow } from "./basecamp-threads";

/**
 * The stored Basecamp threads, with what is needed to read them.
 *
 * Shared by the Basecamp canary and the Daily Basecamp Review routine so the
 * two cannot disagree about which threads exist, or which projects are not
 * clients and should stay out of both.
 */
export async function loadThreadRows(supabase: SupabaseClient): Promise<{
  rows: ThreadRow[];
  clientNames: Map<number, string>;
  ignoredProjectIds: Set<string>;
  error: string | null;
}> {
  const [{ data: rows, error }, { data: clients }, ignores] = await Promise.all([
    supabase
      .from("basecamp_communication_events")
      .select(
        "basecamp_recording_id, client_id, basecamp_project_id, basecamp_project_name, thread_title, thread_url, thread_excerpt, occurred_at, is_internal, reply_need, reply_need_reason, reply_need_escalated, classified_excerpt",
      )
      .order("occurred_at", { ascending: false })
      .returns<ThreadRow[]>(),
    supabase.from("clients").select("id, account_name"),
    listBasecampProjectIgnores(supabase).catch(() => []),
  ]);

  return {
    rows: rows ?? [],
    clientNames: new Map<number, string>(
      (clients ?? []).map((client) => [client.id as number, client.account_name as string]),
    ),
    ignoredProjectIds: new Set(ignores.map((row) => row.basecamp_project_id)),
    error: error?.message ?? null,
  };
}
